"""ASTRANET Phase 5 — Autonomous Recovery and Self-Healing Engine Test Suite.

Comprehensive tests covering:
1. Coordinator failure and deterministic leader election.
2. Global election quorum enforcement (no split-brain or false election).
3. Relay failure and automatic observer promotion.
4. Recoverable compute fault state progression, timing, and health validation.
5. Recoverable communications interface reset and validation.
6. Critical propulsion fault unrecoverable containment.
7. Node loss isolation and loop prevention.
8. Cascading failures, stability, and duplicate event suppression.
9. Simulation-time synchronization: pause and time-warp scaling.
10. Full system regression (kinematics, ISL graph, fault injection, telemetry frame).
"""

import unittest
from typing import List

from backend.app.core.clock import SimulationClock
from backend.app.core.satellite import (
    CubeSat,
    SatelliteState,
    SubsystemStatus,
    SatelliteRole,
)
from backend.app.core.faults import FailureType, FailureSeverity
from backend.app.core.recovery import RecoveryEngine, RecoveryPhase, RecoveryEvent
from backend.app.core.network import NetworkTopology
from backend.app.core.orbit import KeplerianOrbit
from backend.app.core.swarm import SwarmOrchestrator


class TestPhase5CoordinatorElection(unittest.TestCase):
    """Scenario 1 & 2: Dynamic coordinator election and global quorum verification."""

    def setUp(self) -> None:
        self.swarm = SwarmOrchestrator()

    def test_coordinator_failure_in_disconnected_graph_results_in_unresolved_leadership(self) -> None:
        """Requirement 3 & 4: Coordinator loss in partitioned constellation must result in
        UNRESOLVED leadership, without publishing failed coordinator or electing split-brain leaders.
        """
        # Initial coordinator must be SAT-07
        self.assertIsNotNone(self.swarm.coordinator)
        self.assertEqual(self.swarm.coordinator.id, "SAT-07")
        self.assertEqual(self.swarm.coordinator.role, SatelliteRole.COORDINATOR)

        # Inject Node Loss into SAT-07
        self.swarm.inject_fault(
            target_satellite_id="SAT-07",
            failure_type=FailureType.NODE_LOSS,
            severity=FailureSeverity.CRITICAL,
        )

        # Step simulation to trigger autonomous observe-detect-verify-elect pipeline
        self.swarm.step(1.0)

        # SAT-07 must no longer be coordinator
        sat07 = self.swarm.get_satellite("SAT-07")
        self.assertNotEqual(sat07.role, SatelliteRole.COORDINATOR)
        self.assertEqual(sat07.state, SatelliteState.ISOLATED)

        # In baseline graph at t=0 (6 partitions of size 2), no connected component meets quorum of 7
        self.assertTrue(self.swarm.recovery_engine.is_leadership_unresolved)
        self.assertIsNone(self.swarm.coordinator)

        # Telemetry frame must publish UNRESOLVED, never the failed SAT-07
        frame = self.swarm.get_telemetry_frame()
        self.assertEqual(frame["swarmSummary"]["coordinatorId"], "UNRESOLVED")
        self.assertNotEqual(frame["swarmSummary"]["coordinatorId"], "SAT-07")
        self.assertEqual(self.swarm.recovery_engine.last_known_coordinator_id, "SAT-07")

        # Recovery event must record that election is unresolved due to lack of connected quorum
        unresolved_events = [
            ev for ev in self.swarm.events
            if ev.type == "RECOVERY" and "no connected network component meets reachable quorum" in ev.message
        ]
        self.assertTrue(len(unresolved_events) >= 1)

    def test_successful_election_within_connected_component(self) -> None:
        """Requirement 4: When an eligible connected component meets reachable quorum (>=7)
        and strict majority of operational nodes, election deterministically elects a new coordinator.
        """
        connected_net = NetworkTopology()
        # Connect SAT-01 through SAT-08 (7 operational nodes excluding failed SAT-07)
        connected_ids = ["SAT-01", "SAT-02", "SAT-03", "SAT-04", "SAT-05", "SAT-06", "SAT-08"]
        for i in range(len(connected_ids) - 1):
            connected_net._graph.add_edge(connected_ids[i], connected_ids[i + 1])

        self.swarm.recovery_engine._execute_coordinator_election(
            sim_time=1.0,
            satellites=self.swarm.satellites,
            network=connected_net,
            old_coordinator_id="SAT-07",
        )

        self.assertFalse(self.swarm.recovery_engine.is_leadership_unresolved)
        winner_id = self.swarm.recovery_engine.last_known_coordinator_id
        self.assertIn(winner_id, connected_ids)
        winner_sat = self.swarm.get_satellite(winner_id)
        self.assertEqual(winner_sat.role, SatelliteRole.COORDINATOR)

        election_events = [
            ev for ev in self.swarm.events
            if ev.type == "RECOVERY" and "elected swarm coordinator" in ev.message
        ]
        self.assertTrue(len(election_events) >= 1)
        self.assertIn(winner_id, election_events[0].message)

    def test_election_blocked_when_global_quorum_unavailable(self) -> None:
        # Disable 6 satellites out of 12 (leaving 6 operational, less than quorum of 7)
        for i in range(1, 7):
            sat_id = f"SAT-{i:02d}"
            self.swarm.inject_fault(
                target_satellite_id=sat_id,
                failure_type=FailureType.NODE_LOSS,
                severity=FailureSeverity.CRITICAL,
            )

        # Now fail coordinator SAT-07
        self.swarm.inject_fault(
            target_satellite_id="SAT-07",
            failure_type=FailureType.NODE_LOSS,
            severity=FailureSeverity.CRITICAL,
        )

        # Step simulation
        self.swarm.step(1.0)

        # Quorum of 7 cannot be reached (only 5 operational satellites remain)
        self.assertTrue(self.swarm.recovery_engine.is_leadership_unresolved)
        self.assertIsNone(self.swarm.coordinator)

        # Verify an event was recorded warning about insufficient quorum
        quorum_events = [
            ev for ev in self.swarm.events
            if ev.type == "RECOVERY" and "insufficient global quorum" in ev.message
        ]
        self.assertTrue(len(quorum_events) >= 1)
        self.assertEqual(quorum_events[0].severity, "warning")


class TestPhase5RelayReassignment(unittest.TestCase):
    """Scenario 3: Relay failure and automatic observer promotion."""

    def setUp(self) -> None:
        self.swarm = SwarmOrchestrator()

    def test_relay_failure_promotes_healthy_observer_in_same_plane(self) -> None:
        # In baseline constellation, SAT-04 is a RELAY in PLANE A (slot index 3)
        sat04 = self.swarm.get_satellite("SAT-04")
        self.assertEqual(sat04.role, SatelliteRole.RELAY)
        self.assertEqual(sat04.plane, "PLANE A")

        # Fail SAT-04's communications
        self.swarm.inject_fault(
            target_satellite_id="SAT-04",
            failure_type=FailureType.COMMUNICATION_FAILURE,
            severity=FailureSeverity.CRITICAL,
        )

        # Step simulation
        self.swarm.step(1.0)

        # SAT-04 must lose relay role
        self.assertNotEqual(sat04.role, SatelliteRole.RELAY)

        # An eligible observer in PLANE A (SAT-01 or SAT-03) must have been promoted to RELAY
        plane_a_relays = [
            s for s in self.swarm.satellites
            if s.plane == "PLANE A" and s.role == SatelliteRole.RELAY
        ]
        self.assertEqual(len(plane_a_relays), 2)  # SAT-02 + newly promoted node
        newly_promoted = next(s for s in plane_a_relays if s.id != "SAT-02")
        self.assertTrue(newly_promoted.id in ("SAT-01", "SAT-03"))
        self.assertTrue(newly_promoted.capabilities.relay)

        # Verify event was emitted
        reallocation_events = [
            ev for ev in self.swarm.events
            if ev.type == "RECOVERY" and "Relay reassignment" in ev.message
        ]
        self.assertTrue(len(reallocation_events) >= 1)
        self.assertIn(newly_promoted.id, reallocation_events[0].message)


class TestPhase5RecoverableFaults(unittest.TestCase):
    """Scenario 4 & 5: Timed recoverable compute and comms faults."""

    def setUp(self) -> None:
        self.swarm = SwarmOrchestrator()

    def test_recoverable_compute_fault_timing_and_restoration(self) -> None:
        sat = self.swarm.get_satellite("SAT-01")
        self.assertEqual(sat.state, SatelliteState.NOMINAL)

        # Inject compute failure
        self.swarm.inject_fault(
            target_satellite_id="SAT-01",
            failure_type=FailureType.COMPUTE_FAILURE,
            severity=FailureSeverity.MODERATE,
        )

        # Step 0.5s: Node enters RECOVERING
        self.swarm.step(0.5)
        self.assertEqual(sat.state, SatelliteState.RECOVERING)
        self.assertEqual(sat.subsystems.compute, SubsystemStatus.DEGRADED)
        self.assertIn("watchdog reset", sat.autonomy_status.lower())

        # Step 1.5s more (cumulative 2.0s < 3.0s duration): Still recovering
        self.swarm.step(1.5)
        self.assertEqual(sat.state, SatelliteState.RECOVERING)

        # Step 1.5s more (cumulative 3.5s >= 3.0s duration): Must be restored to NOMINAL
        self.swarm.step(1.5)
        self.assertEqual(sat.state, SatelliteState.NOMINAL)
        self.assertEqual(sat.subsystems.compute, SubsystemStatus.NOMINAL)
        self.assertTrue(sat.capabilities.compute)
        self.assertIn("nominal", sat.autonomy_status.lower())

        # Verify completion event
        completion_events = [
            ev for ev in self.swarm.events
            if ev.type == "RECOVERY" and "compute watchdog reset successful" in ev.message
        ]
        self.assertEqual(len(completion_events), 1)
        self.assertEqual(completion_events[0].severity, "nominal")

    def test_recoverable_moderate_comms_fault_restoration(self) -> None:
        sat = self.swarm.get_satellite("SAT-02")

        # Inject moderate comms fault
        self.swarm.inject_fault(
            target_satellite_id="SAT-02",
            failure_type=FailureType.COMMUNICATION_FAILURE,
            severity=FailureSeverity.MODERATE,
        )

        # Step 1.0s: In RECOVERING
        self.swarm.step(1.0)
        self.assertEqual(sat.state, SatelliteState.RECOVERING)

        # Step 4.5s (sim_time is now 1.0 + 4.5 = 5.5s >= 5.0s target completion): Restored to NOMINAL
        self.swarm.step(4.5)
        self.assertEqual(sat.state, SatelliteState.NOMINAL)
        self.assertEqual(sat.subsystems.communications, SubsystemStatus.NOMINAL)
        self.assertTrue(sat.capabilities.relay)

        completion_events = [
            ev for ev in self.swarm.events
            if ev.type == "RECOVERY" and "communications interface reset successful" in ev.message
        ]
        self.assertEqual(len(completion_events), 1)


class TestPhase5UnrecoverableFaults(unittest.TestCase):
    """Scenario 6 & 7: Physical unrecoverable propulsion and node loss."""

    def setUp(self) -> None:
        self.swarm = SwarmOrchestrator()

    def test_critical_propulsion_fault_never_restores_maneuvering(self) -> None:
        sat = self.swarm.get_satellite("SAT-05")

        # Inject critical propulsion failure
        self.swarm.inject_fault(
            target_satellite_id="SAT-05",
            failure_type=FailureType.PROPULSION_FAILURE,
            severity=FailureSeverity.CRITICAL,
        )

        # Step simulation for 10 seconds
        for _ in range(10):
            self.swarm.step(1.0)

        # Propulsion and maneuvering must remain permanently disabled
        self.assertEqual(sat.subsystems.propulsion, SubsystemStatus.FAILED)
        self.assertFalse(sat.capabilities.maneuvering)
        self.assertNotEqual(sat.state, SatelliteState.NOMINAL)
        self.assertIn("propulsion hardware unrecoverable", sat.autonomy_status.lower())

        # No recovery completion event should exist
        completion_events = [
            ev for ev in self.swarm.events
            if ev.type == "RECOVERY" and "propulsion" in ev.message and "restored" in ev.message
        ]
        self.assertEqual(len(completion_events), 0)

    def test_node_loss_permanent_isolation_without_retry_loop(self) -> None:
        sat = self.swarm.get_satellite("SAT-12")

        self.swarm.inject_fault(
            target_satellite_id="SAT-12",
            failure_type=FailureType.NODE_LOSS,
            severity=FailureSeverity.CRITICAL,
        )

        # Step simulation 15 times
        for _ in range(15):
            self.swarm.step(1.0)

        # Satellite remains permanently ISOLATED
        self.assertEqual(sat.state, SatelliteState.ISOLATED)
        self.assertEqual(sat.role, SatelliteRole.ISOLATED)
        self.assertIn("permanently isolated", sat.autonomy_status.lower())

        # Verify no infinite loop of duplicate node loss events
        loss_events = [
            ev for ev in self.swarm.events
            if ev.satellite_id == "SAT-12" and "catastrophic node loss" in ev.message
        ]
        self.assertEqual(len(loss_events), 1)


class TestPhase5CascadingAndTiming(unittest.TestCase):
    """Scenario 8 & 9: Cascading faults, duplicate suppression, pause and time warp."""

    def setUp(self) -> None:
        self.swarm = SwarmOrchestrator()

    def test_cascading_failures_do_not_produce_event_storms(self) -> None:
        # Inject multiple sequential faults
        self.swarm.inject_fault("SAT-01", FailureType.COMPUTE_FAILURE, FailureSeverity.MODERATE)
        self.swarm.step(1.0)

        self.swarm.inject_fault("SAT-02", FailureType.COMMUNICATION_FAILURE, FailureSeverity.CRITICAL)
        self.swarm.step(1.0)

        self.swarm.inject_fault("SAT-07", FailureType.NODE_LOSS, FailureSeverity.CRITICAL)
        self.swarm.step(1.0)

        # Advance for 20 steps
        for _ in range(20):
            self.swarm.step(0.5)

        # Event count must remain bounded and reasonable (no unbounded duplicates)
        total_events = len(self.swarm.events)
        self.assertTrue(total_events < 20)

        # Swarm coordinator must be consistent (0 active coordinators when partitioned and unresolved)
        coordinators = [s for s in self.swarm.satellites if s.role == SatelliteRole.COORDINATOR]
        self.assertEqual(len(coordinators), 0)
        self.assertIsNone(self.swarm.coordinator)
        self.assertEqual(self.swarm.get_telemetry_frame()["swarmSummary"]["coordinatorId"], "UNRESOLVED")

    def test_recovery_timer_advances_with_simulation_time_not_wall_clock(self) -> None:
        sat = self.swarm.get_satellite("SAT-03")

        # Inject compute fault
        self.swarm.inject_fault("SAT-03", FailureType.COMPUTE_FAILURE, FailureSeverity.MODERATE)

        # Advance 0.5s: Node enters RECOVERING
        self.swarm.step(0.5)
        self.assertEqual(sat.state, SatelliteState.RECOVERING)

        # Pause clock
        self.swarm.clock.pause()
        self.assertTrue(self.swarm.clock.is_paused)

        # When paused, background loop does not call step(dt), or step(0.0) is called
        # Calling step(0.0) advances zero simulation time
        self.swarm.step(0.0)
        self.assertEqual(sat.state, SatelliteState.RECOVERING)
        self.assertEqual(self.swarm.clock.elapsed_seconds, 0.5)

        # Resume clock and apply 5x time warp
        self.swarm.clock.resume()
        self.swarm.clock.set_warp(5.0)

        # 1 step with dt=1.0 under 5x warp advances simulation clock by 5.0 seconds
        self.swarm.step(1.0)
        self.assertEqual(self.swarm.clock.elapsed_seconds, 5.5)

        # Since elapsed time (5.5s) > target (0.5s + 3.0s = 3.5s), recovery completes immediately
        self.assertEqual(sat.state, SatelliteState.NOMINAL)
        self.assertEqual(sat.subsystems.compute, SubsystemStatus.NOMINAL)


class TestPhase5RegressionAndIntegrity(unittest.TestCase):
    """Scenario 10: Regression testing existing kinematics, telemetry schema, and reset."""

    def setUp(self) -> None:
        self.swarm = SwarmOrchestrator()

    def test_regression_propagation_and_telemetry_schema(self) -> None:
        # Step simulation for 50 steps
        for _ in range(50):
            self.swarm.step(0.1)

        frame = self.swarm.get_telemetry_frame()

        # Telemetry frame structure checks
        self.assertIn("clock", frame)
        self.assertIn("satellites", frame)
        self.assertIn("links", frame)
        self.assertIn("network", frame)
        self.assertIn("events", frame)
        self.assertIn("swarmSummary", frame)

        self.assertEqual(len(frame["satellites"]), 12)
        self.assertEqual(frame["swarmSummary"]["total"], 12)
        self.assertEqual(frame["swarmSummary"]["missionState"], "NOMINAL")

        # Position and velocity vectors valid
        for s in frame["satellites"]:
            self.assertTrue(s["position"]["altKm"] > 500.0)
            self.assertTrue(s["velocity"]["speedKmS"] > 7.0)

    def test_reset_restores_swarm_and_clears_recovery_events(self) -> None:
        # Inject fault, step, and verify events exist
        self.swarm.inject_fault("SAT-07", FailureType.NODE_LOSS, FailureSeverity.CRITICAL)
        self.swarm.step(1.0)
        self.assertTrue(len(self.swarm.events) > 1)

        # Reset simulation
        self.swarm.reset()

        # All satellites restored to baseline
        self.assertEqual(len(self.swarm.events), 0)
        self.assertEqual(len(self.swarm.recovery_engine.active_tasks), 0)
        self.assertEqual(self.swarm.coordinator.id, "SAT-07")
        self.assertEqual(self.swarm.get_satellite("SAT-07").state, SatelliteState.NOMINAL)


class TestPhase51TargetedDefectCorrections(unittest.TestCase):
    """Phase 5.1: Targeted regression tests for adversarial review defect corrections."""

    def setUp(self) -> None:
        self.swarm = SwarmOrchestrator()

    def test_defect1_preserve_unrecoverable_propulsion_fault_after_compute_recovery(self) -> None:
        """Fix 1: Never unconditionally set NOMINAL after a task completes.
        Preserve concurrent and unrecoverable failures (e.g. propulsion hardware failure).
        """
        sat = self.swarm.get_satellite("SAT-01")

        # 1. Inject critical propulsion failure (permanent hardware fault)
        self.swarm.inject_fault(
            target_satellite_id="SAT-01",
            failure_type=FailureType.PROPULSION_FAILURE,
            severity=FailureSeverity.CRITICAL,
        )
        self.assertEqual(sat.subsystems.propulsion, SubsystemStatus.FAILED)
        self.assertFalse(sat.capabilities.maneuvering)
        self.assertEqual(sat.state, SatelliteState.FAILED)
        self.assertEqual(sat.last_anomaly, "Propulsion Failure (CRITICAL)")

        # Step 0.5s: Propulsion is contained as unrecoverable
        self.swarm.step(0.5)

        # 2. Inject recoverable moderate compute fault
        self.swarm.inject_fault(
            target_satellite_id="SAT-01",
            failure_type=FailureType.COMPUTE_FAILURE,
            severity=FailureSeverity.MODERATE,
        )
        self.swarm.step(0.5)
        # Node enters RECOVERING for compute watchdog reset
        self.assertEqual(sat.state, SatelliteState.RECOVERING)

        # Step 3.5s more (cumulative 4.0s >= 3.0s duration): Compute recovery finishes
        self.swarm.step(3.5)

        # 3. Assert compute is restored, but propulsion remains FAILED and state is NOT NOMINAL
        self.assertEqual(sat.subsystems.compute, SubsystemStatus.NOMINAL)
        self.assertTrue(sat.capabilities.compute)
        self.assertEqual(sat.subsystems.propulsion, SubsystemStatus.FAILED)
        self.assertFalse(sat.capabilities.maneuvering)
        self.assertNotEqual(sat.state, SatelliteState.NOMINAL)
        self.assertEqual(sat.state, SatelliteState.FAILED)
        self.assertIsNotNone(sat.last_anomaly)
        self.assertIn("Propulsion", sat.last_anomaly)

    def test_defect2_allow_subsequent_occurrences_of_same_recoverable_fault(self) -> None:
        """Fix 2: Release processed anomaly tracking when recovery task finishes,
        allowing later occurrences of the same fault to be detected and recovered.
        """
        sat = self.swarm.get_satellite("SAT-02")

        # 1. First injection
        self.swarm.inject_fault("SAT-02", FailureType.COMPUTE_FAILURE, FailureSeverity.MODERATE)
        self.swarm.step(0.5)
        self.assertEqual(sat.state, SatelliteState.RECOVERING)

        # Step until first recovery finishes
        self.swarm.step(3.5)
        self.assertEqual(sat.state, SatelliteState.NOMINAL)
        self.assertEqual(sat.subsystems.compute, SubsystemStatus.NOMINAL)

        # 2. Second injection of same recoverable fault
        self.swarm.inject_fault("SAT-02", FailureType.COMPUTE_FAILURE, FailureSeverity.MODERATE)
        self.swarm.step(0.5)
        self.assertEqual(sat.state, SatelliteState.RECOVERING)

        # Step until second recovery finishes
        self.swarm.step(3.5)
        self.assertEqual(sat.state, SatelliteState.NOMINAL)
        self.assertEqual(sat.subsystems.compute, SubsystemStatus.NOMINAL)

        # Confirm two distinct completion events exist
        completion_events = [
            ev for ev in self.swarm.events
            if ev.satellite_id == "SAT-02" and "compute watchdog reset successful" in ev.message
        ]
        self.assertEqual(len(completion_events), 2)

    def test_defect3_coordinator_telemetry_unresolved_after_failed_election(self) -> None:
        """Fix 3: When no valid coordinator exists, telemetry frame publishes 'UNRESOLVED',
        never publishing a failed or isolated node as active coordinator.
        """
        # Inject catastrophic node loss on coordinator SAT-07
        self.swarm.inject_fault("SAT-07", FailureType.NODE_LOSS, FailureSeverity.CRITICAL)
        self.swarm.step(1.0)

        # Both swarm.coordinator and frame coordinatorId must reflect unresolved leadership
        self.assertIsNone(self.swarm.coordinator)
        frame = self.swarm.get_telemetry_frame()
        self.assertEqual(frame["swarmSummary"]["coordinatorId"], "UNRESOLVED")
        self.assertNotEqual(frame["swarmSummary"]["coordinatorId"], "SAT-07")
        self.assertEqual(self.swarm.recovery_engine.last_known_coordinator_id, "SAT-07")

    def test_defect4_partition_aware_election_disconnected_and_reachable_quorum(self) -> None:
        """Fix 4: Election must not elect a global leader across disconnected components.
        Reachable quorum within candidate's connected component is required.
        """
        # Scenario A: Disconnected components (baseline at t=0 has 6 partitions of size 2)
        self.swarm.inject_fault("SAT-07", FailureType.NODE_LOSS, FailureSeverity.CRITICAL)
        self.swarm.step(1.0)
        self.assertTrue(self.swarm.recovery_engine.is_leadership_unresolved)
        self.assertIsNone(self.swarm.coordinator)

        # Scenario B: Connected component with insufficient reachable quorum (< 7)
        small_net = NetworkTopology()
        # Connect only 4 nodes: SAT-01, SAT-02, SAT-03, SAT-04
        small_net._graph.add_edge("SAT-01", "SAT-02")
        small_net._graph.add_edge("SAT-02", "SAT-03")
        small_net._graph.add_edge("SAT-03", "SAT-04")

        self.swarm.recovery_engine._execute_coordinator_election(
            sim_time=2.0,
            satellites=self.swarm.satellites,
            network=small_net,
            old_coordinator_id="SAT-07",
        )
        self.assertTrue(self.swarm.recovery_engine.is_leadership_unresolved)
        self.assertIsNone(self.swarm.coordinator)

        # Scenario C: Connected component with sufficient reachable quorum (>= 7) and strict majority
        connected_net = NetworkTopology()
        connected_nodes = ["SAT-01", "SAT-02", "SAT-03", "SAT-04", "SAT-05", "SAT-06", "SAT-08"]
        for i in range(len(connected_nodes) - 1):
            connected_net._graph.add_edge(connected_nodes[i], connected_nodes[i + 1])

        self.swarm.recovery_engine._execute_coordinator_election(
            sim_time=3.0,
            satellites=self.swarm.satellites,
            network=connected_net,
            old_coordinator_id="SAT-07",
        )
        self.assertFalse(self.swarm.recovery_engine.is_leadership_unresolved)
        self.assertIsNotNone(self.swarm.coordinator)
        self.assertIn(self.swarm.coordinator.id, connected_nodes)
        frame = self.swarm.get_telemetry_frame()
        self.assertEqual(frame["swarmSummary"]["coordinatorId"], self.swarm.coordinator.id)

    def test_defect5_peer_verification_zero_one_and_sufficient_peers(self) -> None:
        """Fix 5: Differentiate 0 peers (unresolved), 1 peer (local observation),
        and >=2 peers (multi-peer observation) without claiming Byzantine consensus.
        """
        engine = RecoveryEngine()
        net = NetworkTopology()
        orbit = KeplerianOrbit(semi_major_axis_m=6921000.0, eccentricity=0.0, inclination_deg=53.0, raan_deg=0.0, arg_perigee_deg=0.0, initial_phase_deg=0.0)

        target = CubeSat("SAT-01", "Sat1", "PLANE A", 0, "SLOT 01", 0, orbit)
        target.subsystems.compute = SubsystemStatus.FAILED

        # 1. Zero peers: isolated node fails verification honestly
        verified, votes, total, reason = engine._verify_peer_consensus(target, [target], net)
        self.assertFalse(verified)
        self.assertEqual(total, 0)
        self.assertIn("0 reachable peers", reason)

        # 2. One peer: local observation confirmed with explicit limited-confidence disclaimer
        peer1 = CubeSat("SAT-02", "Sat2", "PLANE A", 0, "SLOT 02", 1, orbit)
        peer1.current_state = target.current_state
        verified, votes, total, reason = engine._verify_peer_consensus(target, [target, peer1], net)
        self.assertTrue(verified)
        self.assertEqual(total, 1)
        self.assertIn("Single-peer local observation", reason)

        # 3. Sufficient peers (>=2): multi-peer observation confirms with vote ratio
        peer2 = CubeSat("SAT-03", "Sat3", "PLANE A", 0, "SLOT 03", 2, orbit)
        peer2.current_state = target.current_state
        verified, votes, total, reason = engine._verify_peer_consensus(target, [target, peer1, peer2], net)
        self.assertTrue(verified)
        self.assertEqual(total, 2)
        self.assertIn("Multi-peer observation", reason)

    def test_defect6_power_recovery_bounded_rate_recharge(self) -> None:
        """Fix 6: Power recovery uses a rate-limited, bounded recharge model."""
        sat = self.swarm.get_satellite("SAT-01")
        self.swarm.inject_fault("SAT-01", FailureType.POWER_DEGRADATION, FailureSeverity.MODERATE)
        initial_bat = sat.battery

        self.swarm.step(0.5)
        self.assertEqual(sat.state, SatelliteState.RECOVERING)

        # Step through 5.0s recharge duration
        self.swarm.step(5.5)
        self.assertEqual(sat.state, SatelliteState.NOMINAL)
        self.assertEqual(sat.subsystems.power, SubsystemStatus.NOMINAL)

        # Recharge rate is 5.0%/s * 5.0s = 25.0%
        expected_recharge = min(25.0, 5.0 * RecoveryEngine.SOLAR_RECHARGE_RATE_PCT_PER_SEC)
        self.assertAlmostEqual(sat.battery, min(RecoveryEngine.MAX_RECOVERED_BATTERY_PCT, initial_bat + expected_recharge), delta=0.5)

        power_events = [
            ev for ev in self.swarm.events
            if ev.satellite_id == "SAT-01" and "power recovery complete" in ev.message
        ]
        self.assertEqual(len(power_events), 1)
        self.assertIn("bounded model", power_events[0].message)

    def test_defect7_relay_handover_connectivity_evaluation(self) -> None:
        """Fix 7: Relay handover evaluates the actual recomputed network graph and reports
        the promoted satellite's active ISL neighbor degree (not claiming restored links).
        """
        # Break SAT-04 relay in Plane A
        self.swarm.inject_fault("SAT-04", FailureType.COMMUNICATION_FAILURE, FailureSeverity.CRITICAL)
        self.swarm.step(1.0)

        # Handover event must report active ISL neighbors or partial handover based on graph degrees
        reassignment_events = [
            ev for ev in self.swarm.events
            if ev.type == "RECOVERY" and ("Relay reassignment" in ev.message or "Relay handover partial" in ev.message)
        ]
        self.assertTrue(len(reassignment_events) >= 1)
        event_msg = reassignment_events[0].message
        self.assertTrue("active ISL neighbors" in event_msg or "partial" in event_msg)
        self.assertNotIn("links restored", event_msg)


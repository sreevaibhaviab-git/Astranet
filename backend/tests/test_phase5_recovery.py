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
from backend.app.core.swarm import SwarmOrchestrator


class TestPhase5CoordinatorElection(unittest.TestCase):
    """Scenario 1 & 2: Dynamic coordinator election and global quorum verification."""

    def setUp(self) -> None:
        self.swarm = SwarmOrchestrator()

    def test_coordinator_failure_triggers_deterministic_election(self) -> None:
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

        # A new coordinator must have been elected
        new_coord = self.swarm.coordinator
        self.assertIsNotNone(new_coord)
        self.assertNotEqual(new_coord.id, "SAT-07")
        self.assertEqual(new_coord.role, SatelliteRole.COORDINATOR)
        self.assertEqual(new_coord.state, SatelliteState.NOMINAL)

        # Authoritative telemetry frame must reflect new coordinator
        frame = self.swarm.get_telemetry_frame()
        self.assertEqual(frame["swarmSummary"]["coordinatorId"], new_coord.id)

        # A RECOVERY event must be present recording the election
        election_events = [
            ev for ev in self.swarm.events
            if ev.type == "RECOVERY" and "elected swarm coordinator" in ev.message
        ]
        self.assertTrue(len(election_events) >= 1)
        self.assertIn(new_coord.id, election_events[0].message)

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

        # Swarm coordinator must be unique and consistent
        coordinators = [s for s in self.swarm.satellites if s.role == SatelliteRole.COORDINATOR]
        self.assertEqual(len(coordinators), 1)

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

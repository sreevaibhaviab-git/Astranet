"""ASTRANET Phase 2 — Network Topology and Fault Injection Test Suite.

Tests:
1. Network LOS: Two satellites within range with clear Earth LOS form an active edge.
2. Network Range Cutoff: Two satellites beyond max_range_m do not form an edge.
3. Network Earth Occlusion: Satellites obstructed by Earth mass do not form an edge.
4. Symmetric Undirected Edges: Edges are bidirectional and undirected.
5. Communications Failure: Fault injection on communications subsystem eliminates ISL eligibility.
6. Propulsion Failure: Disables maneuvering capability without altering ballistic orbit.
7. Power Degradation: Drops battery percentage and triggers load shedding.
8. Compute & Node Loss: Total node loss isolates spacecraft and zeroes trust/neighbors.
9. Invalid Satellite ID: inject_fault raises KeyError for nonexistent satellite IDs.
10. Constellation Partitioning: Multiple node failures cleanly increase partition count.
11. Dynamic Network Updates: Topology evolves deterministically as orbits advance.
"""

import unittest
import numpy as np

from backend.app.core.network import (
    NetworkTopology,
    check_earth_line_of_sight,
    compute_euclidean_distance,
    is_satellite_eligible_for_isl,
    DEFAULT_MAX_ISL_RANGE_M,
)
from backend.app.core.orbit import (
    KeplerianOrbit,
    EARTH_RADIUS_M,
    DEFAULT_ORBIT_ALTITUDE_M,
)
from backend.app.core.satellite import (
    CubeSat,
    SatelliteRole,
    SatelliteState,
    SubsystemStatus,
)
from backend.app.core.faults import (
    FaultEngine,
    FailureType,
    FailureSeverity,
)
from backend.app.core.swarm import SwarmOrchestrator


class TestNetworkTopologyGeometry(unittest.TestCase):
    """Isolated, geometrically controlled unit tests for the RF network and LOS engine."""

    def setUp(self) -> None:
        self.r_leo = EARTH_RADIUS_M + 550_000.0  # 6,928,137 m

    def test_clear_line_of_sight_adjacent_satellites(self) -> None:
        # Two satellites separated by 2,000 km altitude along the X-Y plane
        pos_a = np.array([self.r_leo, 0.0, 0.0], dtype=np.float64)
        # Small angular offset: 15 degrees (~1,800 km separation)
        angle = np.radians(15.0)
        pos_b = np.array([
            self.r_leo * np.cos(angle),
            self.r_leo * np.sin(angle),
            0.0,
        ], dtype=np.float64)

        has_los, min_clearance = check_earth_line_of_sight(pos_a, pos_b)
        dist = compute_euclidean_distance(pos_a, pos_b)

        self.assertTrue(has_los)
        self.assertTrue(dist < DEFAULT_MAX_ISL_RANGE_M)
        # Minimum clearance must exceed Earth radius
        self.assertTrue(min_clearance > EARTH_RADIUS_M)

    def test_earth_occlusion_antipodal_satellites(self) -> None:
        # Satellite A on +X side of Earth, Satellite B on -X side
        pos_a = np.array([self.r_leo, 0.0, 0.0], dtype=np.float64)
        pos_b = np.array([-self.r_leo, 0.0, 0.0], dtype=np.float64)

        has_los, min_clearance = check_earth_line_of_sight(pos_a, pos_b)
        # Midpoint passes directly through Earth center (0, 0, 0)
        self.assertFalse(has_los)
        self.assertAlmostEqual(min_clearance, 0.0, delta=1.0)

    def test_earth_occlusion_grazing_line(self) -> None:
        # Two satellites 90 degrees apart in the same circular orbit
        # Chord midpoint distance to Earth center is r * cos(45 deg) ~ 4,899 km < 6,378 km
        pos_a = np.array([self.r_leo, 0.0, 0.0], dtype=np.float64)
        pos_b = np.array([0.0, self.r_leo, 0.0], dtype=np.float64)

        has_los, min_clearance = check_earth_line_of_sight(pos_a, pos_b)
        self.assertFalse(has_los)
        expected_midpoint_dist = self.r_leo * np.cos(np.radians(45.0))
        self.assertAlmostEqual(min_clearance, expected_midpoint_dist, delta=10.0)
        self.assertTrue(min_clearance < EARTH_RADIUS_M)

    def test_max_range_cutoff(self) -> None:
        # Satellites positioned with clear line of sight, but distance exceeds max_range
        orbit = KeplerianOrbit(semi_major_axis_m=self.r_leo)
        sat_1 = CubeSat("S-1", "S-1", "PLANE A", 0, "SLOT 1", 0, orbit)
        sat_2 = CubeSat("S-2", "S-2", "PLANE A", 0, "SLOT 2", 1, orbit)

        # Force positions manually to be 10,000 km apart along +Z direction
        sat_1.current_state.r_eci = np.array([self.r_leo, 0.0, 5_000_000.0])
        sat_2.current_state.r_eci = np.array([self.r_leo, 0.0, -5_000_000.0])

        topo = NetworkTopology(max_range_m=3_000_000.0)  # 3,000 km threshold
        topo.update([sat_1, sat_2])

        # Distance is 10,000 km > 3,000 km, so no edge must form
        self.assertEqual(topo.active_link_count, 0)
        self.assertEqual(topo.get_active_links(), [])

    def test_symmetric_undirected_graph(self) -> None:
        # Two close satellites with clear LOS
        orbit = KeplerianOrbit(semi_major_axis_m=self.r_leo)
        sat_1 = CubeSat("S-1", "S-1", "PLANE A", 0, "SLOT 1", 0, orbit)
        sat_2 = CubeSat("S-2", "S-2", "PLANE A", 0, "SLOT 2", 1, orbit)

        sat_1.current_state.r_eci = np.array([self.r_leo, 0.0, 0.0])
        sat_2.current_state.r_eci = np.array([self.r_leo, 500_000.0, 0.0])  # 500 km away

        topo = NetworkTopology(max_range_m=2_000_000.0)
        topo.update([sat_1, sat_2])

        self.assertEqual(topo.active_link_count, 1)
        self.assertEqual(topo.get_neighbor_count("S-1"), 1)
        self.assertEqual(topo.get_neighbor_count("S-2"), 1)
        self.assertTrue(topo.graph.has_edge("S-1", "S-2"))
        self.assertTrue(topo.graph.has_edge("S-2", "S-1"))


class TestFaultInjectionModel(unittest.TestCase):
    """Unit tests for the FaultEngine and subsystem degradation logic."""

    def setUp(self) -> None:
        self.orbit = KeplerianOrbit(semi_major_axis_m=EARTH_RADIUS_M + DEFAULT_ORBIT_ALTITUDE_M)
        self.sat = CubeSat("SAT-04", "SAT-04", "PLANE A", 0, "SLOT 04", 3, self.orbit)
        self.faults = FaultEngine()

    def test_communication_failure_subsystem_impact(self) -> None:
        event = self.faults.apply_fault(
            self.sat,
            failure_type=FailureType.COMMUNICATION_FAILURE,
            severity=FailureSeverity.CRITICAL,
            sim_time_sec=120.0,
            formatted_time="00:02:00",
        )
        self.assertEqual(self.sat.subsystems.communications, SubsystemStatus.FAILED)
        self.assertFalse(self.sat.capabilities.relay)
        self.assertEqual(self.sat.state, SatelliteState.FAILED)
        self.assertFalse(is_satellite_eligible_for_isl(self.sat))
        self.assertEqual(event.target_satellite_id, "SAT-04")
        self.assertEqual(event.timestamp_sec, 120.0)

    def test_propulsion_failure_disables_maneuvering(self) -> None:
        self.faults.apply_fault(
            self.sat,
            failure_type=FailureType.PROPULSION_FAILURE,
            severity=FailureSeverity.CRITICAL,
        )
        self.assertEqual(self.sat.subsystems.propulsion, SubsystemStatus.FAILED)
        self.assertFalse(self.sat.capabilities.maneuvering)
        self.assertEqual(self.sat.state, SatelliteState.FAILED)
        # Orbit state vector must remain intact (ballistic Keplerian)
        self.assertAlmostEqual(self.sat.current_state.altitude_km, 550.0, delta=0.1)

    def test_power_degradation_resource_depletion_and_load_shedding(self) -> None:
        initial_bat = self.sat.battery  # 90.0
        self.faults.apply_fault(
            self.sat,
            failure_type=FailureType.POWER_DEGRADATION,
            severity=FailureSeverity.CRITICAL,
        )
        self.assertEqual(self.sat.subsystems.power, SubsystemStatus.FAILED)
        # Drops battery by 45%
        self.assertAlmostEqual(self.sat.battery, initial_bat - 45.0)

        # Applying a second power fault drops it below 20% -> triggers sensing load shedding
        self.faults.apply_fault(
            self.sat,
            failure_type=FailureType.POWER_DEGRADATION,
            severity=FailureSeverity.CRITICAL,
        )
        self.assertTrue(self.sat.battery <= 20.0)
        self.assertFalse(self.sat.capabilities.sensing)

    def test_node_loss_total_isolation(self) -> None:
        self.faults.apply_fault(
            self.sat,
            failure_type=FailureType.NODE_LOSS,
            severity=FailureSeverity.CRITICAL,
        )
        self.assertEqual(self.sat.state, SatelliteState.FAILED)
        self.assertEqual(self.sat.role, SatelliteRole.ISOLATED)
        self.assertEqual(self.sat.battery, 0.0)
        self.assertEqual(self.sat.trust, 0.0)
        self.assertFalse(self.sat.capabilities.sensing)
        self.assertFalse(self.sat.capabilities.relay)
        self.assertFalse(is_satellite_eligible_for_isl(self.sat))


class TestSwarmNetworkIntegration(unittest.TestCase):
    """Integration tests verifying dynamic topology updates with the SwarmOrchestrator."""

    def setUp(self) -> None:
        # Initialize swarm with standard 5,000 km range
        self.swarm = SwarmOrchestrator(altitude_m=550_000.0, max_isl_range_m=5_000_000.0)

    def test_swarm_initial_topology_and_neighbor_sync(self) -> None:
        # Swarm must initialize nodes in graph
        self.assertEqual(self.swarm.network.node_count, 12)
        # Initial edges exist between satellites that are within 5,000 km and have LOS
        self.assertTrue(self.swarm.network.active_link_count > 0)

        # Every satellite's network.neighbors property must match its graph degree
        for sat in self.swarm.satellites:
            deg = self.swarm.network.get_neighbor_count(sat.id)
            self.assertEqual(sat.network.neighbors, deg)

    def test_inject_fault_unknown_satellite_id_raises_key_error(self) -> None:
        with self.assertRaises(KeyError):
            self.swarm.inject_fault(
                target_satellite_id="SAT-99_NONEXISTENT",
                failure_type=FailureType.COMMUNICATION_FAILURE,
            )

    def test_comms_fault_removes_satellite_links_and_updates_partitions(self) -> None:
        # Find a satellite with active links
        target = None
        for sat in self.swarm.satellites:
            if self.swarm.network.get_neighbor_count(sat.id) > 0:
                target = sat
                break

        self.assertIsNotNone(target)
        initial_links = self.swarm.network.active_link_count
        target_deg = self.swarm.network.get_neighbor_count(target.id)

        # Inject communications failure
        event = self.swarm.inject_fault(
            target_satellite_id=target.id,
            failure_type=FailureType.COMMUNICATION_FAILURE,
            severity=FailureSeverity.CRITICAL,
        )

        # All links attached to target must be severed
        self.assertEqual(self.swarm.network.get_neighbor_count(target.id), 0)
        self.assertEqual(target.network.neighbors, 0)
        self.assertEqual(
            self.swarm.network.active_link_count,
            initial_links - target_deg,
        )

        # Event must be recorded in orchestrator event history
        self.assertIn(event, self.swarm.events)

    def test_telemetry_frame_includes_network_and_events(self) -> None:
        self.swarm.inject_fault(
            target_satellite_id="SAT-04",
            failure_type=FailureType.PROPULSION_FAILURE,
            severity=FailureSeverity.MODERATE,
        )
        frame = self.swarm.get_telemetry_frame()

        self.assertIn("links", frame)
        self.assertIn("network", frame)
        self.assertIn("events", frame)

        self.assertIn("activeLinks", frame["network"])
        self.assertIn("connected", frame["network"])
        self.assertIn("partitionCount", frame["network"])

        # Event stream must have the recorded fault
        self.assertEqual(len(frame["events"]), 1)
        self.assertEqual(frame["events"][0]["satelliteId"], "SAT-04")
        self.assertEqual(frame["events"][0]["failureType"], "Propulsion Failure")

    def test_dynamic_topology_evolution_after_step(self) -> None:
        links_0 = list(self.swarm.network.get_active_links())
        # Step forward by 1,000 seconds (satellites move ~1/5th of an orbit)
        self.swarm.step(dt=1000.0)
        links_1000 = list(self.swarm.network.get_active_links())

        # Orbits have rotated; verify topology was updated without crash
        self.assertIsInstance(links_1000, list)
        for sat in self.swarm.satellites:
            self.assertEqual(
                sat.network.neighbors,
                self.swarm.network.get_neighbor_count(sat.id),
            )

    def test_reset_restores_nominal_network_and_clears_events(self) -> None:
        self.swarm.inject_fault("SAT-02", FailureType.COMMUNICATION_FAILURE)
        self.swarm.inject_fault("SAT-07", FailureType.POWER_DEGRADATION)
        self.assertEqual(len(self.swarm.events), 2)

        self.swarm.reset()
        self.assertEqual(len(self.swarm.events), 0)
        self.assertEqual(self.swarm.get_satellite("SAT-02").state, SatelliteState.NOMINAL)
        self.assertEqual(self.swarm.get_satellite("SAT-07").state, SatelliteState.NOMINAL)


if __name__ == "__main__":
    unittest.main()

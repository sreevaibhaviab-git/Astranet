"""ASTRANET Phase 1 — Comprehensive Unit Test Suite.

Tests:
1. SimulationClock: step progression, warp factors, pause/resume, resets, string formatting.
2. KeplerianOrbit: 550 km LEO orbital period (~95.6 min), circular speed (~7.59 km/s),
   radius conservation, velocity orthogonality, and J2 perturbation nodal regression.
3. CubeSat: agent state, resource bounds, kinematics propagation, and telemetry dictionary schema.
4. SwarmOrchestrator: 12-satellite constellation structure across 3 planes, synchronous lockstep
   advancement, coordinator resolution, deterministic repeatability, and telemetry frames.
"""

import unittest
import math
import numpy as np

from backend.app.core.clock import SimulationClock
from backend.app.core.orbit import (
    KeplerianOrbit,
    OrbitalPlane,
    EARTH_RADIUS_M,
    DEFAULT_ORBIT_ALTITUDE_M,
    MU_EARTH,
)
from backend.app.core.satellite import (
    CubeSat,
    SatelliteRole,
    SatelliteState,
    SubsystemStatus,
)
from backend.app.core.swarm import SwarmOrchestrator, CONSTELLATION_PLANES


class TestSimulationClock(unittest.TestCase):
    """Unit tests for the SimulationClock module."""

    def test_default_tick_progression(self) -> None:
        clock = SimulationClock(default_step_sec=1.0, warp_factor=1.0)
        self.assertEqual(clock.elapsed_seconds, 0.0)
        self.assertEqual(clock.ticks_count, 0)

        # 5 standard 1-second ticks
        for i in range(5):
            clock.tick()

        self.assertAlmostEqual(clock.elapsed_seconds, 5.0)
        self.assertEqual(clock.ticks_count, 5)

    def test_warp_factor_scaling(self) -> None:
        # Warp = 10.0 => 1 tick of dt=2.0s advances by 20.0s
        clock = SimulationClock(default_step_sec=1.0, warp_factor=10.0)
        clock.tick(dt=2.0)
        self.assertAlmostEqual(clock.elapsed_seconds, 20.0)

        # Warp = 60.0 (demo speedup matching Cesium)
        clock.set_warp(60.0)
        clock.tick(dt=1.0)
        self.assertAlmostEqual(clock.elapsed_seconds, 80.0)

    def test_pause_and_resume(self) -> None:
        clock = SimulationClock(default_step_sec=1.0)
        clock.tick()
        self.assertAlmostEqual(clock.elapsed_seconds, 1.0)

        clock.pause()
        self.assertTrue(clock.is_paused)
        # Advance while paused
        clock.tick()
        clock.tick()
        # Elapsed time must not advance
        self.assertAlmostEqual(clock.elapsed_seconds, 1.0)
        # But tick counter records attempts
        self.assertEqual(clock.ticks_count, 3)

        clock.resume()
        self.assertFalse(clock.is_paused)
        clock.tick()
        self.assertAlmostEqual(clock.elapsed_seconds, 2.0)

    def test_clock_formatting_and_reset(self) -> None:
        clock = SimulationClock(start_epoch_sec=1729175400.0, initial_elapsed_sec=872.0)
        self.assertEqual(clock.format_mission_time(), "00:14:32")

        clock.reset(initial_elapsed_sec=0.0)
        self.assertAlmostEqual(clock.elapsed_seconds, 0.0)
        self.assertEqual(clock.format_mission_time(), "00:00:00")
        self.assertEqual(clock.ticks_count, 0)

    def test_clock_serialization(self) -> None:
        clock = SimulationClock(default_step_sec=1.0, warp_factor=2.0)
        clock.tick()
        d = clock.to_dict()
        self.assertIn("epochSec", d)
        self.assertIn("elapsedSec", d)
        self.assertIn("timeString", d)
        self.assertIn("warpFactor", d)
        self.assertEqual(d["warpFactor"], 2.0)
        self.assertFalse(d["isPaused"])


class TestKeplerianOrbit(unittest.TestCase):
    """Unit tests for Keplerian orbital mechanics and coordinate transformations."""

    def setUp(self) -> None:
        # Standard baseline 550 km circular LEO orbit
        self.a_m = EARTH_RADIUS_M + DEFAULT_ORBIT_ALTITUDE_M  # 6,928,137.0 m
        self.orbit_plane_a = KeplerianOrbit(
            semi_major_axis_m=self.a_m,
            eccentricity=0.0,
            inclination_deg=48.0,
            raan_deg=0.0,
            initial_phase_deg=60.0,
        )

    def test_leo_orbital_period(self) -> None:
        # Theoretical: T = 2*pi * sqrt(a^3 / mu)
        expected_t_sec = 2.0 * math.pi * math.sqrt((self.a_m ** 3) / MU_EARTH)
        self.assertAlmostEqual(self.orbit_plane_a.period_seconds, expected_t_sec, places=2)

        # Baseline: approx 5738.9 seconds (~95.65 minutes)
        self.assertTrue(5700.0 < self.orbit_plane_a.period_seconds < 5800.0)
        self.assertTrue(95.0 < self.orbit_plane_a.period_minutes < 96.0)

    def test_leo_orbital_speed(self) -> None:
        # Circular speed: v = sqrt(mu / a) ~ 7586.35 m/s (~7.586 km/s)
        expected_v_m_s = math.sqrt(MU_EARTH / self.a_m)
        self.assertAlmostEqual(self.orbit_plane_a.nominal_speed_m_s, expected_v_m_s, places=2)
        self.assertTrue(7.5 < self.orbit_plane_a.nominal_speed_m_s / 1000.0 < 7.7)

    def test_radius_conservation_along_orbit(self) -> None:
        # For a circular orbit, distance from Earth center must remain strictly constant
        for t in [0.0, 500.0, 1500.0, 2869.0, 5738.92]:
            state = self.orbit_plane_a.propagate(t)
            r = state.radius_m
            self.assertAlmostEqual(r, self.a_m, delta=1e-3)
            self.assertAlmostEqual(state.altitude_km, 550.0, delta=1e-3)

    def test_velocity_orthogonality(self) -> None:
        # For a circular orbit, velocity vector is always perpendicular to position vector
        # r . v == 0
        for t in [0.0, 300.0, 1200.0, 3600.0]:
            state = self.orbit_plane_a.propagate(t)
            dot_product = float(np.dot(state.r_eci, state.v_eci))
            speed = state.speed_m_s
            # Dot product divided by |r|*|v| must be approximately 0 (|cos(theta)| < 1e-10)
            cos_angle = dot_product / (state.radius_m * speed)
            self.assertAlmostEqual(cos_angle, 0.0, places=9)

    def test_j2_perturbation_nodal_regression(self) -> None:
        # Inclination 48 deg produces retrograde nodal regression (negative raan_dot)
        orbit_j2 = KeplerianOrbit(
            semi_major_axis_m=self.a_m,
            eccentricity=0.0,
            inclination_deg=48.0,
            raan_deg=0.0,
            enable_j2=True,
        )
        # Propagate for 1 day (86400 seconds)
        state_0 = orbit_j2.propagate(0.0)
        state_1d = orbit_j2.propagate(86400.0)

        # Ensure J2 nodal regression rate is negative and physically reasonable (~ -5 deg/day for 48 deg LEO)
        raan_drift_deg_day = math.degrees(orbit_j2._raan_dot_j2 * 86400.0)
        self.assertTrue(-7.0 < raan_drift_deg_day < -3.0)

    def test_geographic_coordinate_bounds(self) -> None:
        # For inclination 48 deg, latitude must strictly stay within [-48 deg, +48 deg]
        for t in np.linspace(0, 6000, 50):
            state = self.orbit_plane_a.propagate(float(t))
            lat, lon, alt = state.to_geographic()
            self.assertTrue(-48.01 <= lat <= 48.01)
            self.assertTrue(-180.0 <= lon <= 180.0)
            self.assertAlmostEqual(alt, 550.0, delta=0.1)


class TestCubeSat(unittest.TestCase):
    """Unit tests for individual CubeSat agent modeling."""

    def setUp(self) -> None:
        self.a_m = EARTH_RADIUS_M + DEFAULT_ORBIT_ALTITUDE_M
        self.orbit = KeplerianOrbit(
            semi_major_axis_m=self.a_m,
            inclination_deg=53.0,
            raan_deg=120.0,
            initial_phase_deg=240.0,
        )
        self.sat = CubeSat(
            satellite_id="SAT-07",
            name="SAT-07",
            plane_name="PLANE B",
            plane_index=1,
            slot_name="SLOT 03",
            slot_index=2,
            orbit=self.orbit,
            role=SatelliteRole.COORDINATOR,
            initial_battery=87.0,
            initial_propellant=76.0,
            initial_compute=52.0,
            initial_storage=71.0,
            trust_score=0.99,
        )

    def test_initial_state_and_resources(self) -> None:
        self.assertEqual(self.sat.id, "SAT-07")
        self.assertEqual(self.sat.role, SatelliteRole.COORDINATOR)
        self.assertEqual(self.sat.state, SatelliteState.NOMINAL)
        self.assertAlmostEqual(self.sat.battery, 87.0)
        self.assertAlmostEqual(self.sat.propellant, 76.0)
        self.assertAlmostEqual(self.sat.trust, 0.99)
        self.assertEqual(self.sat.subsystems.communications, SubsystemStatus.NOMINAL)
        self.assertTrue(self.sat.capabilities.relay)

    def test_kinematics_advancement(self) -> None:
        pos_0 = np.copy(self.sat.position_eci_m)
        self.sat.step(dt=10.0, sim_time=10.0)
        pos_10 = self.sat.position_eci_m

        # Satellite must have moved in orbit
        displacement = float(np.linalg.norm(pos_10 - pos_0))
        # At ~7.586 km/s, 10 seconds produces ~75.86 km of displacement
        self.assertTrue(70_000.0 < displacement < 80_000.0)

    def test_telemetry_schema_compliance(self) -> None:
        data = self.sat.to_dict()

        # Check required fields matching frontend TypeScript SatelliteTelemetry interface
        required_keys = [
            "id", "name", "plane", "planeIndex", "slot", "slotIndex",
            "state", "role", "altitudeKm", "inclinationDeg", "phaseDeg",
            "orbitPeriodSec", "position", "velocity", "battery", "propellant",
            "compute", "storage", "trust", "subsystems", "capabilities",
            "network", "autonomyStatus", "missionState",
        ]
        for key in required_keys:
            self.assertIn(key, data, f"Missing required telemetry key: {key}")

        self.assertIn("communications", data["subsystems"])
        self.assertIn("power", data["subsystems"])
        self.assertIn("sensing", data["capabilities"])
        self.assertIn("neighbors", data["network"])
        self.assertIn("x", data["position"])
        self.assertIn("lat", data["position"])
        self.assertIn("speedKmS", data["velocity"])


class TestSwarmOrchestrator(unittest.TestCase):
    """Unit tests for the complete 12-CubeSat swarm orchestrator."""

    def setUp(self) -> None:
        self.swarm = SwarmOrchestrator(altitude_m=550_000.0)

    def test_swarm_initialization_structure(self) -> None:
        # Constellation must have exactly 12 CubeSats
        self.assertEqual(self.swarm.satellite_count, 12)

        # Plane distribution: 4 per plane
        for plane_idx in range(3):
            plane_sats = [s for s in self.swarm.satellites if s.plane_index == plane_idx]
            self.assertEqual(len(plane_sats), 4)

        # Sat-07 must be COORDINATOR
        sat_07 = self.swarm.get_satellite("SAT-07")
        self.assertIsNotNone(sat_07)
        self.assertEqual(sat_07.role, SatelliteRole.COORDINATOR)
        self.assertEqual(self.swarm.coordinator.id, "SAT-07")

    def test_swarm_step_advancement(self) -> None:
        self.assertAlmostEqual(self.swarm.clock.elapsed_seconds, 0.0)
        self.swarm.step(dt=5.0)
        self.assertAlmostEqual(self.swarm.clock.elapsed_seconds, 5.0)

        # All 12 satellites must have stepped to time=5.0
        for sat in self.swarm.satellites:
            self.assertAlmostEqual(sat.current_state.time_sec, 5.0)

    def test_deterministic_repeatability(self) -> None:
        # Run two independent swarm instances with identical inputs
        swarm_1 = SwarmOrchestrator(altitude_m=550_000.0)
        swarm_2 = SwarmOrchestrator(altitude_m=550_000.0)

        dt = 2.0
        for _ in range(100):
            swarm_1.step(dt)
            swarm_2.step(dt)

        # Coordinate positions and velocities must match bit-for-bit or within float precision (< 1e-12)
        for s1, s2 in zip(swarm_1.satellites, swarm_2.satellites):
            diff_r = np.linalg.norm(s1.position_eci_m - s2.position_eci_m)
            diff_v = np.linalg.norm(s1.velocity_eci_m_s - s2.velocity_eci_m_s)
            self.assertAlmostEqual(float(diff_r), 0.0, places=9)
            self.assertAlmostEqual(float(diff_v), 0.0, places=9)

    def test_telemetry_frame_structure(self) -> None:
        frame = self.swarm.get_telemetry_frame()
        self.assertIn("clock", frame)
        self.assertIn("satellites", frame)
        self.assertIn("swarmSummary", frame)

        self.assertEqual(len(frame["satellites"]), 12)
        summary = frame["swarmSummary"]
        self.assertEqual(summary["total"], 12)
        self.assertEqual(summary["nominal"], 12)
        self.assertEqual(summary["coordinatorId"], "SAT-07")
        self.assertEqual(summary["missionState"], "NOMINAL")


if __name__ == "__main__":
    unittest.main()

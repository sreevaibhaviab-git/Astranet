"""ASTRANET — Swarm Constellation Orchestrator Module.

Manages the deterministic multi-agent simulation for all 12 CubeSats distributed across
three orbital planes (Walker Delta-like constellation), advancing trajectories,
synchronizing kinematics with the master simulation clock, managing the dynamic ISL
communication graph, and handling fault injection with telemetry aggregation.
"""

from typing import List, Dict, Any, Optional, Tuple
from backend.app.core.clock import SimulationClock
from backend.app.core.orbit import (
    KeplerianOrbit,
    OrbitalPlane,
    EARTH_RADIUS_M,
    DEFAULT_ORBIT_ALTITUDE_M,
)
from backend.app.core.satellite import CubeSat, SatelliteRole, SatelliteState
from backend.app.core.network import NetworkTopology, DEFAULT_MAX_ISL_RANGE_M
from backend.app.core.faults import FaultEngine, FaultEvent, FailureType, FailureSeverity
from backend.app.core.recovery import RecoveryEngine, RecoveryEvent


# Canonical Constellation Planes matching ASTRANET architecture
CONSTELLATION_PLANES: List[OrbitalPlane] = [
    OrbitalPlane(name="PLANE A", plane_index=0, inclination_deg=48.0, raan_deg=0.0),
    OrbitalPlane(name="PLANE B", plane_index=1, inclination_deg=53.0, raan_deg=120.0),
    OrbitalPlane(name="PLANE C", plane_index=2, inclination_deg=60.0, raan_deg=240.0),
]

# Slot phase offsets in degrees (4 equally spaced slots per plane)
SLOT_PHASES_DEG: List[float] = [60.0, 150.0, 240.0, 330.0]

# Canonical initial configurations matching mockMissionControl.ts baseline
INITIAL_SATELLITE_CONFIGS: List[Dict[str, Any]] = [
    # Plane A
    {"id": "SAT-01", "name": "SAT-01", "planeIdx": 0, "slotIdx": 0, "role": SatelliteRole.OBSERVER, "bat": 94.0, "prop": 85.0, "cpu": 34.0, "sto": 42.0, "trust": 0.99},
    {"id": "SAT-02", "name": "SAT-02", "planeIdx": 0, "slotIdx": 1, "role": SatelliteRole.RELAY, "bat": 88.0, "prop": 78.0, "cpu": 41.0, "sto": 58.0, "trust": 0.98},
    {"id": "SAT-03", "name": "SAT-03", "planeIdx": 0, "slotIdx": 2, "role": SatelliteRole.OBSERVER, "bat": 91.0, "prop": 82.0, "cpu": 28.0, "sto": 39.0, "trust": 0.99},
    {"id": "SAT-04", "name": "SAT-04", "planeIdx": 0, "slotIdx": 3, "role": SatelliteRole.RELAY, "bat": 85.0, "prop": 74.0, "cpu": 45.0, "sto": 62.0, "trust": 0.97},
    # Plane B
    {"id": "SAT-05", "name": "SAT-05", "planeIdx": 1, "slotIdx": 0, "role": SatelliteRole.OBSERVER, "bat": 90.0, "prop": 80.0, "cpu": 31.0, "sto": 37.0, "trust": 0.99},
    {"id": "SAT-06", "name": "SAT-06", "planeIdx": 1, "slotIdx": 1, "role": SatelliteRole.OBSERVER, "bat": 93.0, "prop": 84.0, "cpu": 27.0, "sto": 33.0, "trust": 0.99},
    {"id": "SAT-07", "name": "SAT-07", "planeIdx": 1, "slotIdx": 2, "role": SatelliteRole.COORDINATOR, "bat": 87.0, "prop": 76.0, "cpu": 52.0, "sto": 71.0, "trust": 0.99},
    {"id": "SAT-08", "name": "SAT-08", "planeIdx": 1, "slotIdx": 3, "role": SatelliteRole.RELAY, "bat": 84.0, "prop": 71.0, "cpu": 48.0, "sto": 65.0, "trust": 0.96},
    # Plane C
    {"id": "SAT-09", "name": "SAT-09", "planeIdx": 2, "slotIdx": 0, "role": SatelliteRole.OBSERVER, "bat": 89.0, "prop": 80.0, "cpu": 29.0, "sto": 35.0, "trust": 0.99},
    {"id": "SAT-10", "name": "SAT-10", "planeIdx": 2, "slotIdx": 1, "role": SatelliteRole.RELAY, "bat": 86.0, "prop": 73.0, "cpu": 32.0, "sto": 43.0, "trust": 0.98},
    {"id": "SAT-11", "name": "SAT-11", "planeIdx": 2, "slotIdx": 2, "role": SatelliteRole.OBSERVER, "bat": 92.0, "prop": 82.0, "cpu": 26.0, "sto": 36.0, "trust": 0.99},
    {"id": "SAT-12", "name": "SAT-12", "planeIdx": 2, "slotIdx": 3, "role": SatelliteRole.OBSERVER, "bat": 88.0, "prop": 78.0, "cpu": 30.0, "sto": 40.0, "trust": 0.98},
]


class SwarmOrchestrator:
    """Coordinates simulation state, advancement, fault injection, and telemetry aggregation."""

    def __init__(
        self,
        altitude_m: float = DEFAULT_ORBIT_ALTITUDE_M,
        enable_j2: bool = False,
        clock: Optional[SimulationClock] = None,
        max_isl_range_m: float = DEFAULT_MAX_ISL_RANGE_M,
    ) -> None:
        """Initialize swarm orchestrator.

        Args:
            altitude_m: Constellation orbital altitude in meters above Earth (default: 550 km).
            enable_j2: Whether to enable secular J2 perturbations on orbits.
            clock: Optional shared SimulationClock instance. If None, a new clock is created.
            max_isl_range_m: Maximum direct inter-satellite communication range in meters.
        """
        self._altitude_m: float = float(altitude_m)
        self._enable_j2: bool = enable_j2
        self.clock: SimulationClock = clock if clock is not None else SimulationClock()

        self.network: NetworkTopology = NetworkTopology(max_range_m=max_isl_range_m)
        self.fault_engine: FaultEngine = FaultEngine()
        self.recovery_engine: RecoveryEngine = RecoveryEngine()

        self._satellites_map: Dict[str, CubeSat] = {}
        self._satellites_list: List[CubeSat] = []
        self._initialize_swarm()

    @property
    def satellites(self) -> List[CubeSat]:
        """List of all CubeSats in the swarm."""
        return self._satellites_list

    @property
    def satellite_count(self) -> int:
        return len(self._satellites_list)

    @property
    def coordinator(self) -> Optional[CubeSat]:
        """Return the current swarm coordinator satellite if one is designated."""
        for sat in self._satellites_list:
            if sat.role == SatelliteRole.COORDINATOR:
                return sat
        return None

    @property
    def events(self) -> List[Any]:
        """Return combined chronological history of all recorded fault and recovery events."""
        all_events = list(self.fault_engine.event_history) + list(self.recovery_engine.event_history)
        all_events.sort(key=lambda ev: ev.timestamp_sec)
        return all_events

    def _sync_network_neighbors(self) -> None:
        """Update each satellite agent's network metric with current graph degrees."""
        for sat in self._satellites_list:
            sat.network.neighbors = self.network.get_neighbor_count(sat.id)

    def _initialize_swarm(self) -> None:
        """Build and register the 12 CubeSats deterministically and initialize the ISL graph."""
        self._satellites_map.clear()
        self._satellites_list.clear()

        semi_major_axis = EARTH_RADIUS_M + self._altitude_m

        for cfg in INITIAL_SATELLITE_CONFIGS:
            plane = CONSTELLATION_PLANES[cfg["planeIdx"]]
            slot_idx = cfg["slotIdx"]
            phase_deg = SLOT_PHASES_DEG[slot_idx]
            slot_name = f"SLOT {slot_idx + 1:02d}"

            orbit = KeplerianOrbit(
                semi_major_axis_m=semi_major_axis,
                eccentricity=0.0,
                inclination_deg=plane.inclination_deg,
                raan_deg=plane.raan_deg,
                arg_perigee_deg=0.0,
                initial_phase_deg=phase_deg,
                enable_j2=self._enable_j2,
            )

            sat = CubeSat(
                satellite_id=cfg["id"],
                name=cfg["name"],
                plane_name=plane.name,
                plane_index=plane.plane_index,
                slot_name=slot_name,
                slot_index=slot_idx,
                orbit=orbit,
                role=cfg["role"],
                initial_battery=cfg["bat"],
                initial_propellant=cfg["prop"],
                initial_compute=cfg["cpu"],
                initial_storage=cfg["sto"],
                trust_score=cfg["trust"],
            )

            self._satellites_map[sat.id] = sat
            self._satellites_list.append(sat)

        # Initial network evaluation
        self.network.update(self._satellites_list)
        self._sync_network_neighbors()

    def get_satellite(self, satellite_id: str) -> Optional[CubeSat]:
        """Look up a satellite by its unique identifier."""
        return self._satellites_map.get(satellite_id)

    def inject_fault(
        self,
        target_satellite_id: str,
        failure_type: FailureType,
        severity: FailureSeverity = FailureSeverity.CRITICAL,
        description: Optional[str] = None,
    ) -> FaultEvent:
        """Inject an anomaly into a specific satellite and recompute constellation topology.

        Args:
            target_satellite_id: Satellite ID (e.g. "SAT-04").
            failure_type: Type of failure from FailureType enum.
            severity: FailureSeverity level.
            description: Optional custom operator message.

        Returns:
            The created FaultEvent.

        Raises:
            KeyError: If target_satellite_id does not exist in the constellation.
        """
        sat = self.get_satellite(target_satellite_id)
        if sat is None:
            raise KeyError(
                f"Target satellite '{target_satellite_id}' not found in constellation"
            )

        event = self.fault_engine.apply_fault(
            satellite=sat,
            failure_type=failure_type,
            severity=severity,
            sim_time_sec=self.clock.elapsed_seconds,
            formatted_time=self.clock.format_mission_time(),
            custom_message=description,
        )

        # Recompute network topology immediately to reflect fault impact
        self.network.update(self._satellites_list)
        self._sync_network_neighbors()

        return event

    def step(self, dt: Optional[float] = None) -> float:
        """Advance the master clock, orbital kinematics, and dynamic network topology in lockstep.

        Args:
            dt: Optional time delta in seconds. If None, clock default step is used.

        Returns:
            New cumulative elapsed time in seconds.
        """
        step_dt = self.clock.default_step_sec if dt is None else float(dt)
        elapsed_sec = self.clock.tick(step_dt)

        # Advance all satellites in constellation
        for sat in self._satellites_list:
            sat.step(dt=step_dt, sim_time=elapsed_sec)

        # Dynamically recalculate communication links based on new positions
        self.network.update(self._satellites_list)
        self._sync_network_neighbors()

        # Phase 5: Autonomous Recovery Engine evaluation
        self.recovery_engine.step(
            sim_time=elapsed_sec,
            satellites=self._satellites_list,
            network=self.network,
        )

        # Re-sync network topology in case recovery reallocated roles or restored comms
        self.network.update(self._satellites_list)
        self._sync_network_neighbors()

        return elapsed_sec

    def reset(self, initial_elapsed_sec: float = 0.0) -> None:
        """Reset the simulation clock, fault engine, and restore all satellites to baseline state."""
        self.clock.reset(initial_elapsed_sec=initial_elapsed_sec)
        self.fault_engine.clear()
        self.recovery_engine.clear()
        self._initialize_swarm()

    def get_telemetry_frame(self) -> Dict[str, Any]:
        """Assemble the complete swarm telemetry frame.

        Structure matches the frontend contract and Phase 0 audit schema.
        """
        nominal_count = sum(1 for s in self._satellites_list if s.state == SatelliteState.NOMINAL)
        degraded_count = sum(
            1 for s in self._satellites_list
            if s.state in (SatelliteState.DEGRADED, SatelliteState.WARNING, SatelliteState.SUSPECTED)
        )
        failed_count = sum(
            1 for s in self._satellites_list
            if s.state in (SatelliteState.FAILED, SatelliteState.ISOLATED)
        )

        coord = self.coordinator
        if coord:
            coordinator_id = coord.id
        elif self.recovery_engine.is_leadership_unresolved and self.recovery_engine._last_known_coordinator_id:
            coordinator_id = self.recovery_engine._last_known_coordinator_id
        else:
            coordinator_id = "NONE"

        all_events = self.events
        return {
            "clock": self.clock.to_dict(),
            "satellites": [sat.to_dict() for sat in self._satellites_list],
            "links": self.network.get_active_links(),
            "network": self.network.to_dict(),
            "events": [ev.to_dict() for ev in reversed(all_events[-10:])],
            "swarmSummary": {
                "total": self.satellite_count,
                "nominal": nominal_count,
                "degraded": degraded_count,
                "failed": failed_count,
                "coordinatorId": coordinator_id,
                "missionCode": "EO-01",
                "missionState": "NOMINAL" if failed_count == 0 else "DEGRADED",
            },
        }

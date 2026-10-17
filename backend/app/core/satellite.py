"""ASTRANET — Spacecraft Agent State and Subsystems Module.

Defines the CubeSat model representing an individual satellite in the swarm,
tracking its physical dynamics, orbital position, subsystem health, onboard resources,
network metrics, and role assignments in full alignment with the frontend telemetry schema.
"""

from enum import Enum
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
import math
import numpy as np

from backend.app.core.orbit import KeplerianOrbit, OrbitState


class SatelliteState(str, Enum):
    NOMINAL = "NOMINAL"
    WARNING = "WARNING"
    SUSPECTED = "SUSPECTED"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"
    ISOLATED = "ISOLATED"
    RECOVERING = "RECOVERING"


class SubsystemStatus(str, Enum):
    NOMINAL = "NOMINAL"
    WARNING = "WARNING"
    DEGRADED = "DEGRADED"
    FAILED = "FAILED"


class SatelliteRole(str, Enum):
    COORDINATOR = "COORDINATOR"
    RELAY = "RELAY"
    OBSERVER = "OBSERVER"
    ISOLATED = "ISOLATED"


@dataclass
class Subsystems:
    communications: SubsystemStatus = SubsystemStatus.NOMINAL
    navigation: SubsystemStatus = SubsystemStatus.NOMINAL
    propulsion: SubsystemStatus = SubsystemStatus.NOMINAL
    power: SubsystemStatus = SubsystemStatus.NOMINAL
    payload: SubsystemStatus = SubsystemStatus.NOMINAL
    attitudeControl: SubsystemStatus = SubsystemStatus.NOMINAL
    compute: SubsystemStatus = SubsystemStatus.NOMINAL

    def to_dict(self) -> Dict[str, str]:
        return {
            "communications": self.communications.value,
            "navigation": self.navigation.value,
            "propulsion": self.propulsion.value,
            "power": self.power.value,
            "payload": self.payload.value,
            "attitudeControl": self.attitudeControl.value,
            "compute": self.compute.value,
        }


@dataclass
class Capabilities:
    sensing: bool = True
    relay: bool = True
    navigation: bool = True
    compute: bool = True
    storage: bool = True
    maneuvering: bool = True

    def to_dict(self) -> Dict[str, bool]:
        return {
            "sensing": self.sensing,
            "relay": self.relay,
            "navigation": self.navigation,
            "compute": self.compute,
            "storage": self.storage,
            "maneuvering": self.maneuvering,
        }


@dataclass
class NetworkMetrics:
    neighbors: int = 4
    latency_ms: float = 18.0
    packet_loss: float = 0.3
    link_quality: float = 97.0
    local_epoch: int = 1842

    def to_dict(self) -> Dict[str, Any]:
        return {
            "neighbors": self.neighbors,
            "latencyMs": round(self.latency_ms, 1),
            "packetLoss": round(self.packet_loss, 2),
            "linkQuality": round(self.link_quality, 1),
            "localEpoch": self.local_epoch,
        }


class CubeSat:
    """Represents an individual 3U/6U CubeSat within the ASTRANET constellation."""

    def __init__(
        self,
        satellite_id: str,
        name: str,
        plane_name: str,
        plane_index: int,
        slot_name: str,
        slot_index: int,
        orbit: KeplerianOrbit,
        role: SatelliteRole = SatelliteRole.OBSERVER,
        initial_battery: float = 90.0,
        initial_propellant: float = 85.0,
        initial_compute: float = 30.0,
        initial_storage: float = 40.0,
        trust_score: float = 0.99,
    ) -> None:
        """Initialize a CubeSat agent.

        Args:
            satellite_id: Unique string ID (e.g. "SAT-07").
            name: Human-readable spacecraft name.
            plane_name: Orbital plane designation ("PLANE A", "PLANE B", "PLANE C").
            plane_index: Index of orbital plane (0, 1, 2).
            slot_name: Slot designation within plane ("SLOT 01", "SLOT 02", etc.).
            slot_index: Index of slot within plane (0, 1, 2, 3).
            orbit: KeplerianOrbit propagator instance for trajectory propagation.
            role: Initial mission role (COORDINATOR, RELAY, OBSERVER).
            initial_battery: State of charge percentage (0-100%).
            initial_propellant: Remaining cold-gas/electric delta-V propellant (0-100%).
            initial_compute: CPU load percentage (0-100%).
            initial_storage: Onboard solid-state storage utilization (0-100%).
            trust_score: Initial Byzantine consensus trust rating (0.0 to 1.0).
        """
        self.id: str = satellite_id
        self.name: str = name
        self.plane: str = plane_name
        self.plane_index: int = plane_index
        self.slot: str = slot_name
        self.slot_index: int = slot_index
        self.orbit: KeplerianOrbit = orbit
        self.role: SatelliteRole = role
        self.state: SatelliteState = SatelliteState.NOMINAL

        # Resource State (percentages 0-100%)
        self.battery: float = float(initial_battery)
        self.propellant: float = float(initial_propellant)
        self.compute: float = float(initial_compute)
        self.storage: float = float(initial_storage)
        self.trust: float = float(trust_score)

        # Subsystems & Capabilities
        self.subsystems: Subsystems = Subsystems()
        self.capabilities: Capabilities = Capabilities()
        self.network: NetworkMetrics = NetworkMetrics()

        # Operational status notes
        self.autonomy_status: str = "No active recovery actions"
        self.mission_state: str = "NOMINAL"
        self.last_anomaly: Optional[str] = None

        # Kinematic state initialized at t=0
        self.current_state: OrbitState = self.orbit.propagate(0.0)

    @property
    def position_eci_m(self) -> np.ndarray:
        return self.current_state.r_eci

    @property
    def velocity_eci_m_s(self) -> np.ndarray:
        return self.current_state.v_eci

    @property
    def altitude_km(self) -> float:
        return self.current_state.altitude_km

    @property
    def speed_km_s(self) -> float:
        return self.current_state.speed_km_s

    def step(self, dt: float, sim_time: float) -> None:
        """Advance satellite state deterministically by dt seconds.

        Updates orbital position and velocity via the orbit propagator,
        and evaluates resource power draw based on operational role.

        Args:
            dt: Time delta for this step in seconds.
            sim_time: Total cumulative simulation elapsed time in seconds.
        """
        # 1. Propagate orbit
        self.current_state = self.orbit.propagate(sim_time)

        # 2. Update resource metrics deterministically if nominal
        if self.state == SatelliteState.NOMINAL:
            # Subtle nominal cyclic power variation (e.g. thermal/payload duty cycles)
            if self.role == SatelliteRole.COORDINATOR:
                self.compute = 35.0 + 3.0 * np.sin(sim_time * 0.05 + self.plane_index)
            elif self.role == SatelliteRole.RELAY:
                self.compute = 32.0 + 2.0 * np.cos(sim_time * 0.05 + self.slot_index)
            else:
                self.compute = 28.0 + 2.0 * np.sin(sim_time * 0.04 + self.slot_index)

    def to_dict(self) -> Dict[str, Any]:
        """Export satellite state in full compatibility with the frontend SatelliteTelemetry schema."""
        geo_lat, geo_lon, alt_km = self.current_state.to_geographic()

        data: Dict[str, Any] = {
            "id": self.id,
            "name": self.name,
            "plane": self.plane,
            "planeIndex": self.plane_index,
            "slot": self.slot,
            "slotIndex": self.slot_index,
            "state": self.state.value,
            "role": self.role.value,
            # Orbital characteristics
            "altitudeKm": round(alt_km, 1),
            "inclinationDeg": round(self.orbit.inclination_deg, 1),
            "phaseDeg": round(math.degrees(self.orbit._phase_0), 1),
            "orbitPeriodSec": round(self.orbit.period_seconds, 1),
            # Physical state vectors for high-precision digital twin
            "position": {
                "x": round(self.current_state.x_km, 3),
                "y": round(self.current_state.y_km, 3),
                "z": round(self.current_state.z_km, 3),
                "lat": round(geo_lat, 4),
                "lon": round(geo_lon, 4),
                "altKm": round(alt_km, 2),
            },
            "velocity": {
                "vx": round(self.current_state.vx_km_s, 4),
                "vy": round(self.current_state.vy_km_s, 4),
                "vz": round(self.current_state.vz_km_s, 4),
                "speedKmS": round(self.speed_km_s, 4),
            },
            # Resource metrics
            "battery": round(self.battery, 1),
            "propellant": round(self.propellant, 1),
            "compute": round(self.compute, 1),
            "storage": round(self.storage, 1),
            "trust": round(self.trust, 2),
            # Subsystems & Capabilities
            "subsystems": self.subsystems.to_dict(),
            "capabilities": self.capabilities.to_dict(),
            "network": self.network.to_dict(),
            # Autonomy
            "autonomyStatus": self.autonomy_status,
            "missionState": self.mission_state,
        }

        if self.last_anomaly:
            data["lastAnomaly"] = self.last_anomaly

        return data

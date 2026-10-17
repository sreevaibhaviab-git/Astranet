"""ASTRANET — Spacecraft Fault Injection and Subsystem Degradation Engine.

Provides a strongly-typed, deterministic fault-injection engine for the CubeSat swarm,
mapping operational anomalies directly to subsystem statuses, capability flags,
resource depletion, and mission event streams.
"""

from enum import Enum
from dataclasses import dataclass
from typing import Dict, Any, Optional, List
import uuid

from backend.app.core.satellite import (
    CubeSat,
    SatelliteState,
    SubsystemStatus,
    SatelliteRole,
)


class FailureType(str, Enum):
    """Supported spacecraft and constellation failure modes."""
    COMMUNICATION_FAILURE = "Communication Failure"
    PROPULSION_FAILURE = "Propulsion Failure"
    POWER_DEGRADATION = "Power Degradation"
    COMPUTE_FAILURE = "Compute Failure"
    NAVIGATION_FAILURE = "Navigation Failure"
    NODE_LOSS = "Node Loss"
    NETWORK_PARTITION = "Network Partition"
    MULTIPLE_FAILURE = "Multiple Failure"


class FailureSeverity(str, Enum):
    """Severity classification for injected anomalies."""
    MINOR = "MINOR"
    MODERATE = "MODERATE"
    CRITICAL = "CRITICAL"


@dataclass
class FaultEvent:
    """Record of an anomaly injected into the constellation."""
    id: str
    timestamp_sec: float
    formatted_time: str
    target_satellite_id: str
    failure_type: FailureType
    severity: FailureSeverity
    description: str

    def to_dict(self) -> Dict[str, Any]:
        """Serialize fault event to dictionary matching frontend MissionEvent schema."""
        return {
            "id": self.id,
            "timestamp": self.formatted_time,
            "type": "FAULT",
            "category": "FAULTS",
            "satelliteId": self.target_satellite_id,
            "severity": "critical" if self.severity == FailureSeverity.CRITICAL else "warning",
            "message": self.description,
            "failureType": self.failure_type.value,
            "failureSeverity": self.severity.value,
        }


class FaultEngine:
    """Orchestrates deterministic fault application across the swarm."""

    def __init__(self) -> None:
        self._event_history: List[FaultEvent] = []

    @property
    def event_history(self) -> List[FaultEvent]:
        """Chronological list of all fault events injected."""
        return self._event_history

    def apply_fault(
        self,
        satellite: CubeSat,
        failure_type: FailureType,
        severity: FailureSeverity = FailureSeverity.CRITICAL,
        sim_time_sec: float = 0.0,
        formatted_time: str = "00:00:00",
        custom_message: Optional[str] = None,
    ) -> FaultEvent:
        """Apply an anomaly to a target CubeSat agent with explicit subsystem impacts.

        Args:
            satellite: Target CubeSat instance to modify.
            failure_type: Specific FailureType to inject.
            severity: FailureSeverity level (MINOR, MODERATE, CRITICAL).
            sim_time_sec: Current simulation elapsed time in seconds.
            formatted_time: Formatted mission time string (HH:MM:SS).
            custom_message: Optional operator description.

        Returns:
            The recorded FaultEvent instance.
        """
        target_state = (
            SatelliteState.FAILED
            if severity == FailureSeverity.CRITICAL
            else SatelliteState.DEGRADED
        )
        status_target = (
            SubsystemStatus.FAILED
            if severity == FailureSeverity.CRITICAL
            else SubsystemStatus.DEGRADED
        )

        # 1. Physical & Subsystem State Transformations
        if failure_type == FailureType.COMMUNICATION_FAILURE:
            satellite.subsystems.communications = status_target
            satellite.capabilities.relay = False
            satellite.trust = min(satellite.trust, 0.45 if severity == FailureSeverity.CRITICAL else 0.75)
            satellite.network.link_quality = 35.0 if severity == FailureSeverity.CRITICAL else 65.0
            satellite.network.packet_loss = 28.5 if severity == FailureSeverity.CRITICAL else 12.0
            satellite.state = target_state

        elif failure_type == FailureType.PROPULSION_FAILURE:
            # Physical meaning: Thruster valve or cold-gas propellant leak disables active
            # orbit maintenance and collision avoidance. Orbit remains purely Keplerian.
            satellite.subsystems.propulsion = status_target
            satellite.capabilities.maneuvering = False
            if severity == FailureSeverity.CRITICAL:
                satellite.propellant = max(5.0, satellite.propellant - 50.0)
            satellite.state = target_state

        elif failure_type == FailureType.POWER_DEGRADATION:
            # Solar panel degradation or battery cell short
            satellite.subsystems.power = status_target
            if severity == FailureSeverity.CRITICAL:
                satellite.battery = max(12.0, satellite.battery - 45.0)
            elif severity == FailureSeverity.MODERATE:
                satellite.battery = max(20.0, satellite.battery - 25.0)
            else:
                satellite.battery = max(30.0, satellite.battery - 10.0)

            # Low power load shedding
            if satellite.battery < 20.0:
                satellite.capabilities.sensing = False
            satellite.state = target_state

        elif failure_type == FailureType.COMPUTE_FAILURE:
            satellite.subsystems.compute = status_target
            satellite.capabilities.compute = False
            satellite.state = target_state

        elif failure_type == FailureType.NAVIGATION_FAILURE:
            satellite.subsystems.navigation = status_target
            satellite.capabilities.navigation = False
            satellite.trust = min(satellite.trust, 0.50)
            satellite.state = target_state

        elif failure_type == FailureType.NODE_LOSS:
            # Catastrophic spacecraft bus or power bus failure
            satellite.subsystems.communications = SubsystemStatus.FAILED
            satellite.subsystems.navigation = SubsystemStatus.FAILED
            satellite.subsystems.propulsion = SubsystemStatus.FAILED
            satellite.subsystems.power = SubsystemStatus.FAILED
            satellite.subsystems.payload = SubsystemStatus.FAILED
            satellite.subsystems.attitudeControl = SubsystemStatus.FAILED
            satellite.subsystems.compute = SubsystemStatus.FAILED

            satellite.capabilities.sensing = False
            satellite.capabilities.relay = False
            satellite.capabilities.navigation = False
            satellite.capabilities.compute = False
            satellite.capabilities.storage = False
            satellite.capabilities.maneuvering = False

            satellite.battery = 0.0
            satellite.trust = 0.0
            satellite.network.neighbors = 0
            satellite.state = SatelliteState.FAILED
            satellite.role = SatelliteRole.ISOLATED

        else:
            # Generic fallback degradation
            satellite.subsystems.attitudeControl = SubsystemStatus.WARNING
            satellite.state = SatelliteState.WARNING

        # 2. Update status and anomaly tags
        satellite.last_anomaly = f"{failure_type.value} ({severity.value})"
        satellite.autonomy_status = f"Fault isolated: {failure_type.value} ({severity.value})"
        satellite.mission_state = "DEGRADED" if satellite.state == SatelliteState.FAILED else "INVESTIGATING"

        # 3. Log Fault Event
        event_id = f"ev-fault-{len(self._event_history) + 1:04d}"
        msg = (
            custom_message
            if custom_message
            else f"{satellite.id} {failure_type.value.lower()} detected ({severity.value})"
        )

        event = FaultEvent(
            id=event_id,
            timestamp_sec=sim_time_sec,
            formatted_time=formatted_time,
            target_satellite_id=satellite.id,
            failure_type=failure_type,
            severity=severity,
            description=msg,
        )
        self._event_history.append(event)
        return event

    def clear(self) -> None:
        """Clear all logged events."""
        self._event_history.clear()

"""ASTRANET — Autonomous Recovery and Self-Healing Engine.

Implements the Phase 5 autonomous recovery pipeline:
OBSERVE → DETECT → VERIFY → DIAGNOSE → ASSESS IMPACT → GENERATE RECOVERY PLAN → EXECUTE → VALIDATE → RECORD EVENT

All state transitions, recovery timers, and consensus checks are deterministic
and advance strictly with simulated elapsed time.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Set, Tuple
import math

from backend.app.core.satellite import (
    CubeSat,
    SatelliteState,
    SubsystemStatus,
    SatelliteRole,
)
from backend.app.core.faults import FailureType, FailureSeverity
from backend.app.core.network import (
    NetworkTopology,
    compute_euclidean_distance,
    check_earth_line_of_sight,
    DEFAULT_MAX_ISL_RANGE_M,
)


class RecoveryPhase(str, Enum):
    """Phases of an autonomous recovery task."""
    DETECTED = "DETECTED"
    VERIFIED = "VERIFIED"
    RECOVERING = "RECOVERING"
    COMPLETED = "COMPLETED"
    UNRESOLVED = "UNRESOLVED"
    UNRECOVERABLE = "UNRECOVERABLE"


@dataclass
class RecoveryEvent:
    """Structured mission recovery event adhering to frontend MissionEvent schema."""
    id: str
    timestamp_sec: float
    formatted_time: str
    satellite_id: Optional[str]
    type: str = "RECOVERY"
    category: str = "RECOVERY"
    severity: str = "info"  # "nominal", "info", "warning", "critical"
    message: str = ""
    failure_type: Optional[str] = None
    failure_severity: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Serialize event to dictionary conforming to MissionEventSchema."""
        return {
            "id": self.id,
            "timestamp": self.formatted_time,
            "type": self.type,
            "category": self.category,
            "satelliteId": self.satellite_id,
            "severity": self.severity,
            "message": self.message,
            "failureType": self.failure_type,
            "failureSeverity": self.failure_severity,
        }


@dataclass
class RecoveryTask:
    """Tracks an ongoing autonomous recovery procedure."""
    task_id: str
    satellite_id: str
    failure_type: FailureType
    severity: FailureSeverity
    phase: RecoveryPhase
    start_sim_time: float
    duration_sec: float
    target_completion_sim_time: float
    action_type: str
    details: Dict[str, Any] = field(default_factory=dict)


class RecoveryEngine:
    """Autonomous fault detection, verification, election, and recovery orchestrator."""

    # Explicit Quorum Thresholds:
    # Minimum observing peers in RF range/LOS required to establish peer verification quorum
    MIN_PEER_QUORUM_COUNT: int = 1
    # Peer agreement fraction required for fault confirmation (2/3 majority when multiple peers)
    PEER_QUORUM_RATIO: float = 0.6667

    # Global Constellation Quorum for Coordinator Election (majority of 12-satellite constellation)
    GLOBAL_ELECTION_QUORUM: int = 7
    # Connected Component Election Quorum (reachable operational nodes in component)
    CONNECTED_ELECTION_QUORUM: int = 7

    # Recovery Durations in Simulation Seconds
    DURATION_COMPUTE_RESET_SEC: float = 3.0
    DURATION_COMMS_RESET_SEC: float = 4.0
    DURATION_POWER_RECHARGE_SEC: float = 5.0

    # Rate-limited bounded solar power recharge model parameters
    SOLAR_RECHARGE_RATE_PCT_PER_SEC: float = 5.0  # 5.0% SoC per second
    MAX_RECOVERED_BATTERY_PCT: float = 95.0

    def __init__(
        self,
        connected_election_quorum: int = 7,
        global_election_quorum: int = 7,
    ) -> None:
        self.connected_election_quorum: int = connected_election_quorum
        self.global_election_quorum: int = global_election_quorum
        self._events: List[RecoveryEvent] = []
        self._active_tasks: Dict[str, RecoveryTask] = {}
        # Tracks anomalies that have already been handled to prevent unbounded duplicate event storms
        self._processed_anomalies: Set[Tuple[str, str, str]] = set()
        # Track last known coordinator ID for graceful handling during leadership vacancy
        self._last_known_coordinator_id: Optional[str] = "SAT-07"
        self._leadership_unresolved: bool = False
        self._event_counter: int = 0

    @property
    def last_known_coordinator_id(self) -> Optional[str]:
        """Last known coordinator satellite ID prior to leadership vacancy."""
        return self._last_known_coordinator_id

    @property
    def event_history(self) -> List[RecoveryEvent]:
        """All recorded recovery events in chronological order."""
        return self._events

    @property
    def active_tasks(self) -> Dict[str, RecoveryTask]:
        """Currently active timed recovery tasks."""
        return self._active_tasks

    @property
    def is_leadership_unresolved(self) -> bool:
        """Whether coordinator election is currently unresolved due to lack of quorum."""
        return self._leadership_unresolved

    def clear(self) -> None:
        """Clear all active recovery states and history (used on simulation reset)."""
        self._events.clear()
        self._active_tasks.clear()
        self._processed_anomalies.clear()
        self._last_known_coordinator_id = "SAT-07"
        self._leadership_unresolved = False
        self._event_counter = 0

    def _next_event_id(self) -> str:
        self._event_counter += 1
        return f"ev-recov-{self._event_counter:04d}"

    def _format_time(self, sim_time_sec: float) -> str:
        total_seconds = int(sim_time_sec)
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        seconds = total_seconds % 60
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"

    def _record_event(
        self,
        sim_time_sec: float,
        satellite_id: Optional[str],
        message: str,
        severity: str = "info",
        failure_type: Optional[str] = None,
        failure_severity: Optional[str] = None,
    ) -> RecoveryEvent:
        event = RecoveryEvent(
            id=self._next_event_id(),
            timestamp_sec=sim_time_sec,
            formatted_time=self._format_time(sim_time_sec),
            satellite_id=satellite_id,
            type="RECOVERY",
            category="RECOVERY",
            severity=severity,
            message=message,
            failure_type=failure_type,
            failure_severity=failure_severity,
        )
        self._events.append(event)
        return event

    # =========================================================================
    # CORE PIPELINE METHODS
    # =========================================================================

    def step(
        self,
        sim_time: float,
        satellites: List[CubeSat],
        network: NetworkTopology,
    ) -> None:
        """Advance autonomous recovery through the 9-step resilience pipeline.

        Args:
            sim_time: Master simulation elapsed time in seconds.
            satellites: Current list of CubeSat agents.
            network: Authoritative dynamic network topology.
        """
        # 1. OBSERVE & DETECT: Find anomalous nodes
        anomalies = self._observe_and_detect(satellites)

        # Process each newly detected anomaly through verification and planning
        for sat, f_type, f_sev in anomalies:
            anomaly_key = (sat.id, f_type.value, f_sev.value)
            if anomaly_key in self._processed_anomalies:
                continue

            # 2. VERIFY: Peer consensus over active / geometric ISL reachability
            verified, votes_for, total_peers, reason = self._verify_peer_consensus(
                target=sat,
                satellites=satellites,
                network=network,
            )

            if not verified:
                # Quorum cannot be formed (e.g. node partitioned or isolated)
                self._record_event(
                    sim_time_sec=sim_time,
                    satellite_id=sat.id,
                    message=f"Peer verification failed for {sat.id}: {reason}",
                    severity="warning",
                    failure_type=f_type.value,
                    failure_severity=f_sev.value,
                )
                sat.autonomy_status = f"Peer verification unresolved: {reason}"
                self._processed_anomalies.add(anomaly_key)
                continue

            # Record successful verification event
            if total_peers == 1:
                verification_msg = (
                    f"Local peer observation confirmed anomaly for {sat.id} "
                    f"(single-peer check; no multi-peer consensus; simulated telemetry inspection)"
                )
            else:
                verification_msg = (
                    f"Multi-peer observation confirmed anomaly for {sat.id} "
                    f"({votes_for}/{total_peers} peers in agreement; threshold {self.PEER_QUORUM_RATIO:.0%})"
                )

            self._record_event(
                sim_time_sec=sim_time,
                satellite_id=sat.id,
                message=verification_msg,
                severity="warning",
                failure_type=f_type.value,
                failure_severity=f_sev.value,
            )

            # 3. DIAGNOSE & ASSESS IMPACT
            is_recoverable, action_type, impact = self._diagnose_and_assess(
                sat=sat,
                failure_type=f_type,
                severity=f_sev,
            )

            # 4. GENERATE RECOVERY PLAN & EXECUTE
            self._generate_and_execute_plan(
                sat=sat,
                failure_type=f_type,
                severity=f_sev,
                is_recoverable=is_recoverable,
                action_type=action_type,
                impact=impact,
                sim_time=sim_time,
                satellites=satellites,
                network=network,
            )
            self._processed_anomalies.add(anomaly_key)

        # 5. ADVANCE ACTIVE TIMED RECOVERIES & VALIDATE
        self._advance_and_validate_active_tasks(sim_time, satellites, network)

        # 6. COORDINATOR HEALTH CHECK & DYNAMIC ELECTION
        self._check_coordinator_health_and_elect(sim_time, satellites, network)

        # 7. RELAY INTEGRITY CHECK & REALLOCATION
        self._check_relay_integrity_and_reallocate(sim_time, satellites, network)

    def _observe_and_detect(
        self,
        satellites: List[CubeSat],
    ) -> List[Tuple[CubeSat, FailureType, FailureSeverity]]:
        """Identify satellites with active anomalies or degraded states."""
        detected: List[Tuple[CubeSat, FailureType, FailureSeverity]] = []

        for sat in satellites:
            # 1. Total node loss or isolation
            if sat.state in (SatelliteState.FAILED, SatelliteState.ISOLATED):
                if sat.subsystems.communications == SubsystemStatus.FAILED and sat.battery <= 1.0:
                    detected.append((sat, FailureType.NODE_LOSS, FailureSeverity.CRITICAL))
                    continue

            # 2. Check individual subsystem failures / degradations
            sub = sat.subsystems
            if sub.communications in (SubsystemStatus.FAILED, SubsystemStatus.DEGRADED):
                sev = FailureSeverity.CRITICAL if sub.communications == SubsystemStatus.FAILED else FailureSeverity.MODERATE
                detected.append((sat, FailureType.COMMUNICATION_FAILURE, sev))

            if sub.compute in (SubsystemStatus.FAILED, SubsystemStatus.DEGRADED):
                sev = FailureSeverity.CRITICAL if sub.compute == SubsystemStatus.FAILED else FailureSeverity.MODERATE
                detected.append((sat, FailureType.COMPUTE_FAILURE, sev))

            if sub.propulsion in (SubsystemStatus.FAILED, SubsystemStatus.DEGRADED):
                sev = FailureSeverity.CRITICAL if sub.propulsion == SubsystemStatus.FAILED else FailureSeverity.MODERATE
                detected.append((sat, FailureType.PROPULSION_FAILURE, sev))

            if sub.power in (SubsystemStatus.FAILED, SubsystemStatus.DEGRADED):
                sev = FailureSeverity.CRITICAL if sub.power == SubsystemStatus.FAILED else FailureSeverity.MODERATE
                detected.append((sat, FailureType.POWER_DEGRADATION, sev))

        return detected

    def _verify_peer_consensus(
        self,
        target: CubeSat,
        satellites: List[CubeSat],
        network: NetworkTopology,
    ) -> Tuple[bool, int, int, str]:
        """Verify suspected anomaly through peer observation over geometric ISLs.

        NOTE ON CONSENSUS & SENSOR FIDELITY:
        Peer verification in this simulation is a deterministic heuristic where neighboring
        spacecraft with line-of-sight inspect shared target telemetry flags and link responsiveness.
        This does NOT represent cryptographic Byzantine consensus or noisy distributed sensor
        filtering. A single peer observation is treated as a local sanity check with limited
        confidence, not strong consensus.

        Returns:
            (verified: bool, votes_for: int, total_peers: int, reason: str)
        """
        pos_target = target.position_eci_m

        # Find operational peers that have clear RF Line-of-Sight and are within maximum ISL range
        candidate_peers: List[CubeSat] = []
        for p in satellites:
            if p.id == target.id:
                continue
            if p.state in (SatelliteState.FAILED, SatelliteState.ISOLATED):
                continue
            if p.subsystems.communications == SubsystemStatus.FAILED:
                continue

            dist_m = compute_euclidean_distance(pos_target, p.position_eci_m)
            if dist_m > network.max_range_m:
                continue

            has_los, _ = check_earth_line_of_sight(
                pos_target,
                p.position_eci_m,
                network.earth_radius_m,
                network.atmosphere_buffer_m,
            )
            if has_los:
                candidate_peers.append(p)

        total_peers = len(candidate_peers)

        # Quorum Check: Must have at least MIN_PEER_QUORUM_COUNT peers within range and LOS
        if total_peers == 0:
            return (
                False,
                0,
                0,
                f"isolated node: 0 reachable peers in line of sight (minimum {self.MIN_PEER_QUORUM_COUNT} required)",
            )
        if total_peers < self.MIN_PEER_QUORUM_COUNT:
            return (
                False,
                0,
                total_peers,
                f"insufficient peers in line of sight ({total_peers}/{self.MIN_PEER_QUORUM_COUNT} required)",
            )

        # In simulated ISL cross-checking, peers evaluate target responsiveness and telemetry flags
        votes_for = 0
        for p in candidate_peers:
            # Anomaly is observable if link is down or target broadcasts non-nominal subsystem
            target_is_anomalous = (
                target.state in (SatelliteState.FAILED, SatelliteState.ISOLATED, SatelliteState.DEGRADED, SatelliteState.SUSPECTED)
                or target.subsystems.communications == SubsystemStatus.FAILED
                or target.subsystems.compute == SubsystemStatus.FAILED
                or target.subsystems.propulsion == SubsystemStatus.FAILED
                or target.subsystems.power == SubsystemStatus.FAILED
            )
            if target_is_anomalous:
                votes_for += 1

        agreement_ratio = votes_for / total_peers
        if agreement_ratio >= self.PEER_QUORUM_RATIO:
            if total_peers == 1:
                reason = "Single-peer local observation confirmed anomaly (limited confidence; single-peer check)"
            else:
                reason = f"Multi-peer observation confirmed ({votes_for}/{total_peers} peers in agreement)"
            return True, votes_for, total_peers, reason
        else:
            return (
                False,
                votes_for,
                total_peers,
                f"peer vote fell below threshold ({votes_for}/{total_peers} = {agreement_ratio:.1%} < {self.PEER_QUORUM_RATIO:.1%})",
            )

    def _diagnose_and_assess(
        self,
        sat: CubeSat,
        failure_type: FailureType,
        severity: FailureSeverity,
    ) -> Tuple[bool, str, Dict[str, Any]]:
        """Diagnose whether anomaly is recoverable under current simulation models."""
        impact = {
            "was_coordinator": (sat.role == SatelliteRole.COORDINATOR),
            "was_relay": (sat.role == SatelliteRole.RELAY),
            "plane": sat.plane,
            "subsystem": failure_type.value,
        }

        # 1. Catastrophic Node Loss: Irreversible hardware loss
        if failure_type == FailureType.NODE_LOSS:
            return False, "ISOLATE_NODE", impact

        # 2. Critical Propulsion: Hardware propellant leak/thruster valve seizure
        if failure_type == FailureType.PROPULSION_FAILURE:
            return False, "ISOLATE_PROPULSION", impact

        # 3. Critical Communications: Hardware transmitter burnout
        if failure_type == FailureType.COMMUNICATION_FAILURE and severity == FailureSeverity.CRITICAL:
            return False, "UNRECOVERABLE_COMMS", impact

        # 4. Critical Power: Irreversible battery cell destruction
        if failure_type == FailureType.POWER_DEGRADATION and severity == FailureSeverity.CRITICAL:
            return False, "LOAD_SHED_PERMANENT", impact

        # 5. Recoverable: Compute Failure (watchdog reset & memory scrub)
        if failure_type == FailureType.COMPUTE_FAILURE:
            return True, "RESET_COMPUTE", impact

        # 6. Recoverable: Moderate/Minor Comms Failure (transceiver interface cycle)
        if failure_type == FailureType.COMMUNICATION_FAILURE and severity in (FailureSeverity.MODERATE, FailureSeverity.MINOR):
            return True, "RESET_COMMS", impact

        # 7. Recoverable: Moderate/Minor Power Degradation (load shed and solar recharge)
        if failure_type == FailureType.POWER_DEGRADATION and severity in (FailureSeverity.MODERATE, FailureSeverity.MINOR):
            return True, "RECHARGE_POWER", impact

        # Default fallback: Treat as unrecoverable to avoid false recovery
        return False, "UNRECOVERABLE_GENERIC", impact

    def _generate_and_execute_plan(
        self,
        sat: CubeSat,
        failure_type: FailureType,
        severity: FailureSeverity,
        is_recoverable: bool,
        action_type: str,
        impact: Dict[str, Any],
        sim_time: float,
        satellites: List[CubeSat],
        network: NetworkTopology,
    ) -> None:
        """Create recovery task or apply immediate safe containment."""
        if is_recoverable:
            # Determine task duration
            if action_type == "RESET_COMPUTE":
                duration = self.DURATION_COMPUTE_RESET_SEC
                status_desc = "Autonomous recovery active: watchdog reset & software memory scrub"
            elif action_type == "RESET_COMMS":
                duration = self.DURATION_COMMS_RESET_SEC
                status_desc = "Autonomous recovery active: transceiver interface reset and recalibration"
            else:  # RECHARGE_POWER
                duration = self.DURATION_POWER_RECHARGE_SEC
                status_desc = "Autonomous recovery active: shedding non-essential load for solar battery recharge"
                sat.capabilities.sensing = False

            task_id = f"task-{sat.id}-{len(self._active_tasks) + 1}"
            task = RecoveryTask(
                task_id=task_id,
                satellite_id=sat.id,
                failure_type=failure_type,
                severity=severity,
                phase=RecoveryPhase.RECOVERING,
                start_sim_time=sim_time,
                duration_sec=duration,
                target_completion_sim_time=sim_time + duration,
                action_type=action_type,
                details=impact,
            )
            self._active_tasks[sat.id] = task
            sat.state = SatelliteState.RECOVERING
            sat.autonomy_status = status_desc

            self._record_event(
                sim_time_sec=sim_time,
                satellite_id=sat.id,
                message=f"{sat.id} entered RECOVERING: initiated {action_type} (est. {duration:.1f}s sim time)",
                severity="info",
                failure_type=failure_type.value,
                failure_severity=severity.value,
            )

        else:
            # Unrecoverable hardware failure: Safe containment
            if action_type == "ISOLATE_NODE":
                was_relay = impact.get("was_relay", False)
                sat.state = SatelliteState.ISOLATED
                sat.role = SatelliteRole.ISOLATED
                sat.autonomy_status = "Node declared lost: permanently isolated from swarm topology"
                self._record_event(
                    sim_time_sec=sim_time,
                    satellite_id=sat.id,
                    message=f"{sat.id} catastrophic node loss: permanently isolated from constellation",
                    severity="critical",
                    failure_type=failure_type.value,
                    failure_severity=severity.value,
                )
                if was_relay:
                    self._reallocate_relay_in_plane(sim_time, sat, satellites, network)

            elif action_type == "ISOLATE_PROPULSION":
                sat.capabilities.maneuvering = False
                sat.autonomy_status = "Propulsion hardware unrecoverable: maneuvering disabled; assigned to passive ballistic tracking"
                self._record_event(
                    sim_time_sec=sim_time,
                    satellite_id=sat.id,
                    message=f"{sat.id} propulsion unrecoverable: thruster offline; satellite excluded from maneuvers",
                    severity="warning",
                    failure_type=failure_type.value,
                    failure_severity=severity.value,
                )
            elif action_type == "UNRECOVERABLE_COMMS":
                was_relay = impact.get("was_relay", False) or (sat.role == SatelliteRole.RELAY)
                sat.capabilities.relay = False
                if sat.role == SatelliteRole.RELAY:
                    sat.role = SatelliteRole.OBSERVER
                sat.autonomy_status = "Communications hardware unrecoverable: isolated from relay duties"
                self._record_event(
                    sim_time_sec=sim_time,
                    satellite_id=sat.id,
                    message=f"{sat.id} communications hardware unrecoverable: transmitter disabled permanently",
                    severity="warning",
                    failure_type=failure_type.value,
                    failure_severity=severity.value,
                )
                if was_relay:
                    self._reallocate_relay_in_plane(sim_time, sat, satellites, network)
            else:
                sat.autonomy_status = f"Anomaly unrecoverable under flight rules: {failure_type.value}"
                self._record_event(
                    sim_time_sec=sim_time,
                    satellite_id=sat.id,
                    message=f"{sat.id} {failure_type.value} unrecoverable: operating in safe degraded mode",
                    severity="warning",
                    failure_type=failure_type.value,
                    failure_severity=severity.value,
                )

    def _recompute_satellite_state_and_anomaly(
        self,
        sat: CubeSat,
        recovered_subsystem: str,
        completing_task_id: Optional[str] = None,
    ) -> None:
        """Recompute overall satellite health state, last anomaly, and autonomy status.

        Restores only the subsystem associated with the completed recovery task.
        Preserves concurrent failures (including permanent propulsion and communications failures).
        Ensures a recovering satellite cannot be marked NOMINAL while an unrecoverable failure remains.
        """
        sub = sat.subsystems
        failed_subsystems: List[str] = []
        degraded_subsystems: List[str] = []

        subsystem_list = [
            ("communications", sub.communications),
            ("compute", sub.compute),
            ("propulsion", sub.propulsion),
            ("power", sub.power),
            ("navigation", sub.navigation),
            ("payload", sub.payload),
            ("attitudeControl", sub.attitudeControl),
        ]

        for name, status in subsystem_list:
            if status == SubsystemStatus.FAILED:
                failed_subsystems.append(name)
            elif status == SubsystemStatus.DEGRADED:
                degraded_subsystems.append(name)

        has_other_active_tasks = any(
            t.satellite_id == sat.id and (completing_task_id is None or t.task_id != completing_task_id)
            for t in self._active_tasks.values()
        )
        is_isolated = (sat.role == SatelliteRole.ISOLATED or sat.state == SatelliteState.ISOLATED)

        # 1. State recomputation
        if is_isolated or failed_subsystems:
            sat.state = SatelliteState.ISOLATED if is_isolated else SatelliteState.FAILED
        elif has_other_active_tasks:
            sat.state = SatelliteState.RECOVERING
        elif degraded_subsystems:
            sat.state = SatelliteState.DEGRADED
        else:
            sat.state = SatelliteState.NOMINAL

        # 2. Anomaly string and autonomy status recomputation
        if failed_subsystems:
            primary = failed_subsystems[0].capitalize()
            if not sat.last_anomaly or not any(f.lower() in sat.last_anomaly.lower() for f in failed_subsystems):
                sat.last_anomaly = f"{primary} Failure (CRITICAL)"
            sat.autonomy_status = (
                f"Autonomous {recovered_subsystem} recovery complete; "
                f"satellite remains FAILED due to unrecovered {', '.join(failed_subsystems)}"
            )
        elif degraded_subsystems:
            primary = degraded_subsystems[0].capitalize()
            if not sat.last_anomaly or not any(d.lower() in sat.last_anomaly.lower() for d in degraded_subsystems):
                sat.last_anomaly = f"{primary} Degradation (MODERATE)"
            sat.autonomy_status = (
                f"Autonomous {recovered_subsystem} recovery complete; "
                f"satellite remains DEGRADED due to {', '.join(degraded_subsystems)}"
            )
        elif is_isolated:
            if not sat.last_anomaly:
                sat.last_anomaly = "Node Loss (CRITICAL)"
            sat.autonomy_status = f"Autonomous {recovered_subsystem} recovery complete; node remains isolated"
        else:
            sat.last_anomaly = None
            sat.autonomy_status = f"Autonomous {recovered_subsystem} recovery complete: nominal state validated"

    def _advance_and_validate_active_tasks(
        self,
        sim_time: float,
        satellites: List[CubeSat],
        network: NetworkTopology,
    ) -> None:
        """Advance active timed recoveries and validate restored health upon timer expiry."""
        completed_tasks: List[Tuple[str, RecoveryTask]] = []

        for sat_id, task in list(self._active_tasks.items()):
            sat = next((s for s in satellites if s.id == sat_id), None)
            if not sat:
                completed_tasks.append((sat_id, task))
                continue

            # Check if simulation elapsed time has reached target completion
            if sim_time >= task.target_completion_sim_time:
                action = task.action_type

                if action == "RESET_COMPUTE":
                    sat.subsystems.compute = SubsystemStatus.NOMINAL
                    sat.capabilities.compute = True
                    sat.compute = 30.0
                    sat.trust = min(1.0, sat.trust + 0.05)
                    self._recompute_satellite_state_and_anomaly(sat, "compute", completing_task_id=task.task_id)

                    self._record_event(
                        sim_time_sec=sim_time,
                        satellite_id=sat.id,
                        message=f"{sat.id} compute watchdog reset successful: flight software restored to NOMINAL",
                        severity="nominal",
                        failure_type=task.failure_type.value,
                        failure_severity=task.severity.value,
                    )

                elif action == "RESET_COMMS":
                    sat.subsystems.communications = SubsystemStatus.NOMINAL
                    sat.capabilities.relay = True
                    sat.network.link_quality = 95.0
                    sat.network.packet_loss = 0.5
                    sat.trust = min(1.0, sat.trust + 0.05)
                    self._recompute_satellite_state_and_anomaly(sat, "comms", completing_task_id=task.task_id)

                    self._record_event(
                        sim_time_sec=sim_time,
                        satellite_id=sat.id,
                        message=f"{sat.id} communications interface reset successful: ISL capability restored to NOMINAL",
                        severity="nominal",
                        failure_type=task.failure_type.value,
                        failure_severity=task.severity.value,
                    )

                elif action == "RECHARGE_POWER":
                    recharge_amount = min(25.0, task.duration_sec * self.SOLAR_RECHARGE_RATE_PCT_PER_SEC)
                    sat.battery = min(self.MAX_RECOVERED_BATTERY_PCT, sat.battery + recharge_amount)
                    sat.subsystems.power = SubsystemStatus.NOMINAL
                    sat.capabilities.sensing = True
                    self._recompute_satellite_state_and_anomaly(sat, "power", completing_task_id=task.task_id)

                    self._record_event(
                        sim_time_sec=sim_time,
                        satellite_id=sat.id,
                        message=f"{sat.id} power recovery complete: battery recharged by +{recharge_amount:.1f}% to {sat.battery:.1f}% SoC (bounded model)",
                        severity="nominal",
                        failure_type=task.failure_type.value,
                        failure_severity=task.severity.value,
                    )

                completed_tasks.append((sat_id, task))

        for sat_id, task in completed_tasks:
            self._active_tasks.pop(sat_id, None)
            # Release processed anomaly tracking so subsequent recoverable occurrences can be handled
            anomaly_key = (task.satellite_id, task.failure_type.value, task.severity.value)
            self._processed_anomalies.discard(anomaly_key)

    # =========================================================================
    # DYNAMIC COORDINATOR ELECTION
    # =========================================================================

    def _check_coordinator_health_and_elect(
        self,
        sim_time: float,
        satellites: List[CubeSat],
        network: NetworkTopology,
    ) -> None:
        """Verify coordinator availability and execute deterministic election if needed."""
        current_coord = next((s for s in satellites if s.role == SatelliteRole.COORDINATOR), None)

        is_coord_available = False
        if current_coord:
            if (
                current_coord.state not in (SatelliteState.FAILED, SatelliteState.ISOLATED)
                and current_coord.subsystems.communications != SubsystemStatus.FAILED
                and current_coord.subsystems.compute != SubsystemStatus.FAILED
                and current_coord.battery > 15.0
            ):
                is_coord_available = True
                self._last_known_coordinator_id = current_coord.id
                self._leadership_unresolved = False

        if not is_coord_available:
            old_coord_id = current_coord.id if current_coord else (self._last_known_coordinator_id or "NONE")
            if current_coord:
                # Strip coordinator role from the unavailable coordinator to prevent telemetry contradictions
                current_coord.role = (
                    SatelliteRole.ISOLATED
                    if current_coord.state in (SatelliteState.FAILED, SatelliteState.ISOLATED)
                    else SatelliteRole.OBSERVER
                )
            self._execute_coordinator_election(sim_time, satellites, network, old_coord_id)

    def _execute_coordinator_election(
        self,
        sim_time: float,
        satellites: List[CubeSat],
        network: NetworkTopology,
        old_coordinator_id: str,
    ) -> None:
        """Elect new coordinator using partition-aware connected quorum and multi-factor ranking."""
        # 1. Filter operational and eligible candidates
        operational_nodes: List[CubeSat] = []
        for s in satellites:
            if s.state in (SatelliteState.FAILED, SatelliteState.ISOLATED):
                continue
            if s.subsystems.communications == SubsystemStatus.FAILED:
                continue
            if s.subsystems.compute == SubsystemStatus.FAILED:
                continue
            if s.battery <= 20.0:
                continue
            operational_nodes.append(s)

        # 2. Check Global Quorum
        total_ops = len(operational_nodes)
        if total_ops < self.global_election_quorum:
            if not self._leadership_unresolved:
                self._leadership_unresolved = True
                self._record_event(
                    sim_time_sec=sim_time,
                    satellite_id=None,
                    message=(
                        f"Coordinator election failed: insufficient global quorum "
                        f"({total_ops}/{self.global_election_quorum} operational nodes required); "
                        f"leadership unresolved (last known: {old_coordinator_id})"
                    ),
                    severity="warning",
                )
            return

        # 3. Partition-Aware Component Evaluation
        # Require reachable quorum within candidate's connected component and strict majority
        # of all operational nodes (> total_ops // 2) to prevent split-brain leadership.
        connected_components = network.get_connected_components()
        op_map = {s.id: s for s in operational_nodes}

        eligible_component_ops: Optional[List[CubeSat]] = None
        max_component_op_count = 0

        for comp in connected_components:
            comp_ops = [op_map[sat_id] for sat_id in comp if sat_id in op_map]
            if len(comp_ops) > max_component_op_count:
                max_component_op_count = len(comp_ops)

            # Quorum requires reachable connected quorum and strict majority of operational nodes
            if len(comp_ops) >= self.connected_election_quorum and len(comp_ops) > (total_ops // 2):
                eligible_component_ops = comp_ops
                break

        if eligible_component_ops is None:
            if not self._leadership_unresolved:
                self._leadership_unresolved = True
                self._record_event(
                    sim_time_sec=sim_time,
                    satellite_id=None,
                    message=(
                        f"Coordinator election unresolved: no connected network component meets "
                        f"reachable quorum (largest component has {max_component_op_count} operational nodes, "
                        f"required: {self.connected_election_quorum} with strict majority > {total_ops // 2}); "
                        f"leadership unresolved (last known: {old_coordinator_id})"
                    ),
                    severity="warning",
                )
            return

        # 4. Deterministic normalized candidate scoring within eligible connected component
        def compute_candidate_score(cand: CubeSat) -> float:
            s_bat = cand.battery / 100.0
            s_prop = cand.propellant / 100.0
            s_cpu = max(0.0, 100.0 - cand.compute) / 100.0
            s_sto = max(0.0, 100.0 - cand.storage) / 100.0
            s_trust = cand.trust
            deg = network.get_neighbor_count(cand.id)
            s_links = min(1.0, deg / 6.0)
            return (
                0.30 * s_bat
                + 0.15 * s_prop
                + 0.15 * s_cpu
                + 0.10 * s_sto
                + 0.20 * s_trust
                + 0.10 * s_links
            )

        scored_candidates = [
            (compute_candidate_score(c), c.id, c)
            for c in eligible_component_ops
        ]
        # Sort by: -score, then alphabetical satellite ID for strict determinism
        scored_candidates.sort(key=lambda item: (-round(item[0], 4), item[1]))

        winner_score, winner_id, winner_sat = scored_candidates[0]

        # 5. Apply role updates consistently
        for s in satellites:
            if s.id == winner_id:
                s.role = SatelliteRole.COORDINATOR
                s.autonomy_status = f"Elected swarm coordinator (score: {winner_score:.2f})"
            elif s.role == SatelliteRole.COORDINATOR:
                # Demote former coordinator if it was not the winner
                s.role = (
                    SatelliteRole.ISOLATED
                    if s.state in (SatelliteState.FAILED, SatelliteState.ISOLATED)
                    else SatelliteRole.OBSERVER
                )

        self._last_known_coordinator_id = winner_id
        self._leadership_unresolved = False

        self._record_event(
            sim_time_sec=sim_time,
            satellite_id=winner_id,
            message=(
                f"Dynamic election succeeded: {winner_id} elected swarm coordinator "
                f"within connected component of {len(eligible_component_ops)} nodes "
                f"(score: {winner_score:.2f}) replacing {old_coordinator_id}"
            ),
            severity="nominal",
        )

    # =========================================================================
    # RELAY INTEGRITY & ROLE REALLOCATION
    # =========================================================================

    def _check_relay_integrity_and_reallocate(
        self,
        sim_time: float,
        satellites: List[CubeSat],
        network: NetworkTopology,
    ) -> None:
        """Detect failed relay nodes and reassign relay responsibilities to healthy observers."""
        for sat in satellites:
            if sat.role != SatelliteRole.RELAY:
                continue

            # Check if relay is broken
            is_relay_broken = (
                sat.state in (SatelliteState.FAILED, SatelliteState.ISOLATED)
                or sat.subsystems.communications == SubsystemStatus.FAILED
                or not sat.capabilities.relay
            )

            if is_relay_broken:
                # Strip broken relay role
                sat.role = SatelliteRole.ISOLATED if sat.state in (SatelliteState.FAILED, SatelliteState.ISOLATED) else SatelliteRole.OBSERVER
                self._reallocate_relay_in_plane(sim_time, sat, satellites, network)

    def _reallocate_relay_in_plane(
        self,
        sim_time: float,
        broken_relay: CubeSat,
        satellites: List[CubeSat],
        network: NetworkTopology,
    ) -> None:
        """Find eligible observer in same plane to promote to RELAY."""
        plane_candidates: List[CubeSat] = []
        for s in satellites:
            if s.plane_index != broken_relay.plane_index:
                continue
            if s.role != SatelliteRole.OBSERVER:
                continue
            if s.state in (SatelliteState.FAILED, SatelliteState.ISOLATED):
                continue
            if s.subsystems.communications != SubsystemStatus.NOMINAL:
                continue
            if s.battery < 30.0:
                continue
            plane_candidates.append(s)

        if not plane_candidates:
            self._record_event(
                sim_time_sec=sim_time,
                satellite_id=broken_relay.id,
                message=f"Relay reallocation unresolved: no eligible observer in {broken_relay.plane} to replace {broken_relay.id}",
                severity="warning",
            )
            return

        # Rank candidates by: composite battery/trust, then slot distance, then ID
        def candidate_rank(cand: CubeSat) -> Tuple[float, int, str]:
            score = (cand.battery / 100.0) * cand.trust
            slot_dist = -abs(cand.slot_index - broken_relay.slot_index)
            return (-round(score, 3), slot_dist, cand.id)

        plane_candidates.sort(key=candidate_rank)
        replacement = plane_candidates[0]

        replacement.role = SatelliteRole.RELAY
        replacement.capabilities.relay = True

        # Re-evaluate network graph to evaluate if useful connectivity was restored
        network.update(satellites)
        restored_neighbors = network.get_neighbor_count(replacement.id)

        if restored_neighbors > 0:
            replacement.autonomy_status = (
                f"Promoted to RELAY in {replacement.plane} replacing {broken_relay.id} "
                f"({restored_neighbors} active ISL links)"
            )
            self._record_event(
                sim_time_sec=sim_time,
                satellite_id=replacement.id,
                message=(
                    f"Relay reassignment: {replacement.id} promoted to RELAY in {replacement.plane} "
                    f"replacing {broken_relay.id} (restored {restored_neighbors} active ISL links)"
                ),
                severity="nominal",
            )
        else:
            replacement.autonomy_status = (
                f"Assigned RELAY in {replacement.plane} replacing {broken_relay.id} "
                f"(partial handover: 0 active links)"
            )
            self._record_event(
                sim_time_sec=sim_time,
                satellite_id=replacement.id,
                message=(
                    f"Relay handover partial: {replacement.id} promoted to RELAY in {replacement.plane} "
                    f"replacing {broken_relay.id}, but no active ISL links restored (0 neighbors)"
                ),
                severity="warning",
            )

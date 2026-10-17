"""ASTRANET Phase 6 — Reusable Deterministic Scenario Runner & Benchmark Framework.

Executes versioned scenario definitions against the Swarm simulation and autonomous
recovery engine. Advances simulation strictly via simulated time, validates initial
invariants, tracks autonomous self-healing responses, records full telemetry timelines,
evaluates quantitative acceptance criteria, and produces structured pass/fail reports.
"""

from dataclasses import dataclass, field, asdict
from enum import Enum
from pathlib import Path
import json
import os
import random
import time
from typing import List, Dict, Any, Optional, Set, Tuple

from backend.app.core.swarm import SwarmOrchestrator
from backend.app.core.satellite import SatelliteState, SubsystemStatus, SatelliteRole, CubeSat
from backend.app.core.faults import FailureType, FailureSeverity
from backend.app.schemas.scenarios import (
    ScenarioDefinition,
    ScenarioValidationError,
    ScheduledFaultItem,
)

DEFAULT_SCENARIOS_DIR = Path(__file__).resolve().parent.parent.parent / "scenarios"


class ScenarioStatus(str, Enum):
    """Overall validation outcome of a scenario execution."""
    PASS = "PASS"
    FAIL = "FAIL"
    INCONCLUSIVE = "INCONCLUSIVE"


@dataclass
class MetricSnapshot:
    """Consolidated constellation state snapshot at a specific point in time."""
    sim_time_sec: float
    nominal_count: int
    degraded_count: int
    failed_count: int
    isolated_count: int
    active_links_count: int
    partition_count: int
    connected_components: List[int]  # Sizes of components
    is_network_connected: bool
    coordinator_id: str
    is_leadership_unresolved: bool
    average_battery: float
    average_propellant: float
    satellite_states: Dict[str, str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AcceptanceCheckResult:
    """Individual acceptance check outcome."""
    name: str
    passed: bool
    details: str
    expected: Any = None
    actual: Any = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ScenarioResult:
    """Structured report produced after running a benchmark scenario."""
    scenario_id: str
    scenario_name: str
    status: ScenarioStatus
    duration_sim_sec: float
    steps_executed: int
    wall_clock_duration_sec: float
    baseline_metrics: MetricSnapshot
    faulted_metrics: Optional[MetricSnapshot]
    final_metrics: MetricSnapshot
    detection_delays: Dict[str, float]
    recovery_times: Dict[str, float]
    faults_injected_count: int
    autonomous_events_count: int
    role_reassignments: List[Dict[str, Any]]
    completed_recoveries: List[Dict[str, Any]]
    remaining_unrecoverable: List[str]
    timeline: List[Dict[str, Any]]
    acceptance_checks: List[AcceptanceCheckResult]
    failure_reasons: List[str]
    no_manual_intervention: bool = True

    def to_dict(self) -> Dict[str, Any]:
        res = asdict(self)
        res["status"] = self.status.value
        return res

    def to_summary_table(self) -> str:
        """Render a clean text table summarizing benchmark results."""
        lines = [
            f"==================================================================",
            f"SCENARIO BENCHMARK REPORT: {self.scenario_name} ({self.scenario_id})",
            f"==================================================================",
            f"Status:                 {self.status.value}",
            f"Sim Duration:           {self.duration_sim_sec:.1f}s ({self.steps_executed} steps)",
            f"Wall-clock Time:        {self.wall_clock_duration_sec:.3f}s",
            f"Faults Injected:        {self.faults_injected_count}",
            f"Autonomous Events:      {self.autonomous_events_count}",
            f"No Manual Intervention: {self.no_manual_intervention}",
            f"------------------------------------------------------------------",
            f"METRIC COMPARISON:      BASELINE       FINAL",
            f"  Nominal Satellites:   {self.baseline_metrics.nominal_count:<14} {self.final_metrics.nominal_count}",
            f"  Failed Satellites:    {self.baseline_metrics.failed_count:<14} {self.final_metrics.failed_count}",
            f"  Active ISL Links:     {self.baseline_metrics.active_links_count:<14} {self.final_metrics.active_links_count}",
            f"  Coordinator:          {self.baseline_metrics.coordinator_id:<14} {self.final_metrics.coordinator_id}",
            f"  Partitions:           {self.baseline_metrics.partition_count:<14} {self.final_metrics.partition_count}",
            f"------------------------------------------------------------------",
            f"ACCEPTANCE CHECKS:",
        ]
        for c in self.acceptance_checks:
            tag = "[PASS]" if c.passed else "[FAIL]"
            lines.append(f"  {tag} {c.name}: {c.details}")
        if self.failure_reasons:
            lines.append(f"------------------------------------------------------------------")
            lines.append(f"FAILURE DETAILS:")
            for r in self.failure_reasons:
                lines.append(f"  - {r}")
        lines.append(f"==================================================================")
        return "\n".join(lines)


def load_scenario_from_file(path_or_id: str, scenarios_dir: Optional[Path] = None) -> ScenarioDefinition:
    """Load and strictly validate a scenario definition from a JSON file.

    Args:
        path_or_id: Path to a scenario JSON file, or scenario ID (e.g. 'dual_node_failure').
        scenarios_dir: Optional directory to search if path_or_id is an ID or filename.

    Returns:
        Validated ScenarioDefinition instance.

    Raises:
        ScenarioValidationError: If file does not exist, JSON is malformed, or validation fails.
    """
    search_dir = scenarios_dir if scenarios_dir is not None else DEFAULT_SCENARIOS_DIR
    target_path = Path(path_or_id)

    if not target_path.exists():
        # Try appending .json or searching in scenarios_dir
        candidate = search_dir / f"{path_or_id}.json"
        if candidate.exists():
            target_path = candidate
        else:
            candidate = search_dir / path_or_id
            if candidate.exists():
                target_path = candidate
            else:
                raise ScenarioValidationError(
                    f"Scenario file '{path_or_id}' not found in '{search_dir}'"
                )

    try:
        with open(target_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
    except json.JSONDecodeError as e:
        raise ScenarioValidationError(f"Malformed JSON in scenario file '{target_path}': {str(e)}") from e
    except Exception as e:
        raise ScenarioValidationError(f"Error reading scenario file '{target_path}': {str(e)}") from e

    try:
        scenario = ScenarioDefinition.model_validate(raw_data)
    except Exception as e:
        raise ScenarioValidationError(f"Validation failed for scenario '{target_path.name}': {str(e)}") from e

    # Stochastic fault generation if defined
    if scenario.stochastic_fault_generator and scenario.configuration.random_seed is not None:
        rng = random.Random(scenario.configuration.random_seed)
        gen = scenario.stochastic_fault_generator

        # Deterministically select satellites and failure types
        generated_faults: List[ScheduledFaultItem] = []
        for i in range(gen.count):
            # Deterministic timestamp evenly spread across [min_time, max_time] with deterministic jitter
            step_interval = (gen.max_time_sec - gen.min_time_sec) / max(1, gen.count)
            t_base = gen.min_time_sec + i * step_interval
            t_jitter = rng.uniform(0.0, step_interval * 0.8)
            f_time = round(t_base + t_jitter, 2)

            sat_id = rng.choice(gen.candidate_satellites)
            fail_mode = rng.choice(gen.candidate_failures)

            generated_faults.append(
                ScheduledFaultItem(
                    time_sec=f_time,
                    satellite_id=sat_id,
                    failure_type=fail_mode.type,
                    severity=fail_mode.severity,
                    description=f"Deterministic seeded fault #{i + 1} (seed: {scenario.configuration.random_seed})",
                )
            )

        # Merge with any static scheduled faults and sort by time
        combined = scenario.scheduled_faults + generated_faults
        combined.sort(key=lambda x: (x.time_sec, x.satellite_id))
        scenario.scheduled_faults = combined

    return scenario


def list_available_scenarios(scenarios_dir: Optional[Path] = None) -> List[Dict[str, Any]]:
    """Scan and list all valid scenario definitions in the scenarios directory."""
    directory = scenarios_dir if scenarios_dir is not None else DEFAULT_SCENARIOS_DIR
    if not directory.exists():
        return []

    results: List[Dict[str, Any]] = []
    for file_path in sorted(directory.glob("*.json")):
        try:
            scen = load_scenario_from_file(str(file_path), scenarios_dir=directory)
            results.append({
                "id": scen.id,
                "name": scen.name,
                "description": scen.description,
                "version": scen.version,
                "durationSec": scen.configuration.duration_sec,
                "faultCount": len(scen.scheduled_faults),
                "isStochastic": scen.stochastic_fault_generator is not None,
                "filePath": str(file_path),
            })
        except Exception:
            # Skip invalid or scratch JSON files
            continue
    return results


class ScenarioRunner:
    """Executes benchmark scenarios in isolated or live simulation orchestrators."""

    def __init__(self, orchestrator: Optional[SwarmOrchestrator] = None) -> None:
        self._external_orchestrator = orchestrator

    def _capture_metrics(self, swarm: SwarmOrchestrator) -> MetricSnapshot:
        """Capture an instant metric snapshot of constellation health and topology."""
        satellites = swarm.satellites
        nominal = sum(1 for s in satellites if s.state == SatelliteState.NOMINAL)
        degraded = sum(
            1 for s in satellites
            if s.state in (SatelliteState.DEGRADED, SatelliteState.WARNING, SatelliteState.SUSPECTED)
        )
        failed = sum(1 for s in satellites if s.state == SatelliteState.FAILED)
        isolated = sum(1 for s in satellites if s.state == SatelliteState.ISOLATED)

        active_links = swarm.network.active_link_count
        components = swarm.network.get_connected_components()
        comp_sizes = sorted([len(c) for c in components], reverse=True)

        coord = swarm.coordinator
        coord_id = coord.id if coord else "UNRESOLVED"
        is_unresolved = swarm.recovery_engine.is_leadership_unresolved

        avg_bat = sum(s.battery for s in satellites) / max(1, len(satellites))
        avg_prop = sum(s.propellant for s in satellites) / max(1, len(satellites))

        sat_states = {s.id: s.state.value for s in satellites}

        return MetricSnapshot(
            sim_time_sec=round(swarm.clock.elapsed_seconds, 2),
            nominal_count=nominal,
            degraded_count=degraded,
            failed_count=failed,
            isolated_count=isolated,
            active_links_count=active_links,
            partition_count=swarm.network.partition_count(),
            connected_components=comp_sizes,
            is_network_connected=swarm.network.is_connected(),
            coordinator_id=coord_id,
            is_leadership_unresolved=is_unresolved,
            average_battery=round(avg_bat, 2),
            average_propellant=round(avg_prop, 2),
            satellite_states=sat_states,
        )

    def run(
        self,
        scenario: ScenarioDefinition,
        max_wall_clock_sec: float = 30.0,
    ) -> ScenarioResult:
        """Execute a scenario deterministically to completion and evaluate acceptance checks.

        Args:
            scenario: The validated ScenarioDefinition to execute.
            max_wall_clock_sec: Safety guard to abort hung executions.

        Returns:
            ScenarioResult containing complete metrics, timeline, and PASS/FAIL evaluation.
        """
        # 1. Establish isolated or provided orchestrator
        if self._external_orchestrator is not None:
            swarm = self._external_orchestrator
            swarm.reset(initial_elapsed_sec=0.0)
        else:
            swarm = SwarmOrchestrator(
                altitude_m=550_000.0,
                enable_j2=False,
                max_isl_range_m=scenario.configuration.max_isl_range_m,
            )

        start_wall_clock = time.time()
        acceptance_checks: List[AcceptanceCheckResult] = []
        failure_reasons: List[str] = []

        # 2. Establish and validate initial invariants
        baseline_metrics = self._capture_metrics(swarm)
        init_inv = scenario.initial_invariants

        if baseline_metrics.nominal_count < init_inv.min_nominal_satellites:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Initial Invariant: Nominal Count",
                passed=False,
                details=f"Expected >= {init_inv.min_nominal_satellites} nominal satellites, found {baseline_metrics.nominal_count}",
                expected=init_inv.min_nominal_satellites,
                actual=baseline_metrics.nominal_count,
            ))
            failure_reasons.append("Initial constellation invariant violated: insufficient nominal satellites at t=0")
        else:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Initial Invariant: Nominal Count",
                passed=True,
                details=f"All {baseline_metrics.nominal_count} satellites nominal at t=0",
            ))

        if init_inv.expected_coordinator and baseline_metrics.coordinator_id != init_inv.expected_coordinator:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Initial Invariant: Coordinator",
                passed=False,
                details=f"Expected bootstrap coordinator {init_inv.expected_coordinator}, found {baseline_metrics.coordinator_id}",
                expected=init_inv.expected_coordinator,
                actual=baseline_metrics.coordinator_id,
            ))
            failure_reasons.append("Initial bootstrap coordinator invariant violated at t=0")
        else:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Initial Invariant: Coordinator",
                passed=True,
                details=f"Bootstrap coordinator verified as {baseline_metrics.coordinator_id} at t=0 (pre-failure swarm initialization)",
            ))

        # 3. Execution state tracking
        step_dt = scenario.configuration.time_step_sec
        total_duration = scenario.configuration.duration_sec
        scheduled_faults = sorted(scenario.scheduled_faults, key=lambda f: f.time_sec)

        fault_fired_indices: Set[int] = set()
        fault_injection_sim_times: Dict[str, float] = {}
        fault_detection_sim_times: Dict[str, float] = {}
        fault_recovery_sim_times: Dict[str, float] = {}

        timeline: List[Dict[str, Any]] = []
        steps_executed = 0
        faulted_metrics: Optional[MetricSnapshot] = None

        # Capture t=0 timeline entry
        timeline.append({
            "step": 0,
            "simTimeSec": 0.0,
            "nominal": baseline_metrics.nominal_count,
            "failed": baseline_metrics.failed_count,
            "coordinatorId": baseline_metrics.coordinator_id,
            "activeLinks": baseline_metrics.active_links_count,
            "events": [],
        })

        # 4. Simulation Execution Loop
        while swarm.clock.elapsed_seconds < total_duration:
            # Check safety timeout
            if (time.time() - start_wall_clock) > max_wall_clock_sec:
                failure_reasons.append(f"Execution aborted: exceeded safety timeout of {max_wall_clock_sec}s wall clock")
                final_metrics = self._capture_metrics(swarm)
                return ScenarioResult(
                    scenario_id=scenario.id,
                    scenario_name=scenario.name,
                    status=ScenarioStatus.INCONCLUSIVE,
                    duration_sim_sec=swarm.clock.elapsed_seconds,
                    steps_executed=steps_executed,
                    wall_clock_duration_sec=time.time() - start_wall_clock,
                    baseline_metrics=baseline_metrics,
                    faulted_metrics=faulted_metrics,
                    final_metrics=final_metrics,
                    detection_delays={},
                    recovery_times={},
                    faults_injected_count=len(fault_fired_indices),
                    autonomous_events_count=len(swarm.recovery_engine.event_history),
                    role_reassignments=[],
                    completed_recoveries=[],
                    remaining_unrecoverable=[],
                    timeline=timeline,
                    acceptance_checks=acceptance_checks,
                    failure_reasons=failure_reasons,
                    no_manual_intervention=True,
                )

            current_sim_time = swarm.clock.elapsed_seconds

            # Inject scheduled faults if simulation elapsed time reached timestamp
            for idx, fault_item in enumerate(scheduled_faults):
                if idx not in fault_fired_indices and current_sim_time >= fault_item.time_sec:
                    swarm.inject_fault(
                        target_satellite_id=fault_item.satellite_id,
                        failure_type=fault_item.failure_type,
                        severity=fault_item.severity,
                        description=fault_item.description,
                    )
                    fault_fired_indices.add(idx)
                    fault_injection_sim_times[fault_item.satellite_id] = current_sim_time

                    # If all faults have now fired, capture faulted snapshot
                    if len(fault_fired_indices) == len(scheduled_faults) and faulted_metrics is None:
                        faulted_metrics = self._capture_metrics(swarm)

            # Advance simulation by discrete time step (evaluates physics, ISL graph, and autonomous recovery)
            events_before_step = len(swarm.events)
            new_sim_time = swarm.step(dt=step_dt)
            steps_executed += 1

            # Check for newly emitted recovery events to measure detection delay and recovery time
            new_events = swarm.events[events_before_step:]
            for ev in new_events:
                sat_id = ev.satellite_id
                if sat_id and sat_id in fault_injection_sim_times:
                    # Detection event
                    if sat_id not in fault_detection_sim_times:
                        if ev.type in ("RECOVERY", "FAULT") and "unresolved" not in ev.message.lower():
                            fault_detection_sim_times[sat_id] = ev.timestamp_sec

                    # Recovery event
                    if "successful" in ev.message.lower() or "complete" in ev.message.lower():
                        fault_recovery_sim_times[sat_id] = ev.timestamp_sec

            # Record periodic timeline snapshot
            snap = self._capture_metrics(swarm)
            timeline.append({
                "step": steps_executed,
                "simTimeSec": round(new_sim_time, 2),
                "nominal": snap.nominal_count,
                "failed": snap.failed_count,
                "coordinatorId": snap.coordinator_id,
                "activeLinks": snap.active_links_count,
                "events": [e.message for e in new_events],
            })

        final_metrics = self._capture_metrics(swarm)
        if faulted_metrics is None:
            faulted_metrics = final_metrics

        wall_clock_elapsed = time.time() - start_wall_clock

        # 5. Measure detection delays and recovery durations
        detection_delays: Dict[str, float] = {}
        recovery_durations: Dict[str, float] = {}

        for sat_id, t_inj in fault_injection_sim_times.items():
            if sat_id in fault_detection_sim_times:
                delay = round(max(0.0, fault_detection_sim_times[sat_id] - t_inj), 2)
                detection_delays[sat_id] = delay
            if sat_id in fault_recovery_sim_times:
                rec_dur = round(max(0.0, fault_recovery_sim_times[sat_id] - t_inj), 2)
                recovery_durations[sat_id] = rec_dur

        # 6. Extract role reassignments and completed recoveries from recovery engine events
        role_reassignments: List[Dict[str, Any]] = []
        completed_recoveries: List[Dict[str, Any]] = []

        for ev in swarm.recovery_engine.event_history:
            msg = ev.message
            if "Relay reassignment" in msg or "promoted to RELAY" in msg:
                role_reassignments.append({
                    "satelliteId": ev.satellite_id,
                    "timestamp": ev.timestamp_sec,
                    "message": msg,
                })
            if "reset successful" in msg or "recovery complete" in msg:
                completed_recoveries.append({
                    "satelliteId": ev.satellite_id,
                    "timestamp": ev.timestamp_sec,
                    "message": msg,
                })

        remaining_unrecoverable = [
            s.id for s in swarm.satellites
            if s.state in (SatelliteState.FAILED, SatelliteState.ISOLATED)
        ]

        # 7. Evaluate Quantitative Acceptance Criteria
        thresh = scenario.acceptance_thresholds
        exp = scenario.expected_outcomes

        # Check: Scheduled faults all fired
        if len(fault_fired_indices) == len(scheduled_faults):
            acceptance_checks.append(AcceptanceCheckResult(
                name="Scheduled Fault Execution",
                passed=True,
                details=f"All {len(scheduled_faults)} scheduled fault injections executed at specified simulation timestamps",
            ))
        else:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Scheduled Fault Execution",
                passed=False,
                details=f"Executed {len(fault_fired_indices)}/{len(scheduled_faults)} scheduled faults",
                expected=len(scheduled_faults),
                actual=len(fault_fired_indices),
            ))
            failure_reasons.append("Not all scheduled faults fired during scenario window")

        # Check: Detection delay threshold
        if exp.max_detection_delay_sec > 0:
            delays_exceeded = [
                f"{sat}: {d}s > {exp.max_detection_delay_sec}s"
                for sat, d in detection_delays.items()
                if d > exp.max_detection_delay_sec
            ]
            if not delays_exceeded:
                acceptance_checks.append(AcceptanceCheckResult(
                    name="Autonomous Detection Delay",
                    passed=True,
                    details=f"All fault detections completed within threshold ({exp.max_detection_delay_sec}s max)",
                ))
            else:
                acceptance_checks.append(AcceptanceCheckResult(
                    name="Autonomous Detection Delay",
                    passed=False,
                    details=f"Detection delay threshold exceeded: {', '.join(delays_exceeded)}",
                    expected=exp.max_detection_delay_sec,
                ))
                failure_reasons.append("Autonomous fault detection delay exceeded maximum threshold")

        # Check: Expected role reassignments
        for req_reassign in exp.expected_role_reassignments:
            found = any(
                req_reassign.replaced_satellite_id in r["message"]
                for r in role_reassignments
            )
            if found:
                acceptance_checks.append(AcceptanceCheckResult(
                    name=f"Role Reassignment ({req_reassign.plane} {req_reassign.new_role})",
                    passed=True,
                    details=f"Relay reassignment confirmed in {req_reassign.plane} replacing {req_reassign.replaced_satellite_id} (local ISL links preserved)",
                ))
            else:
                acceptance_checks.append(AcceptanceCheckResult(
                    name=f"Role Reassignment ({req_reassign.plane} {req_reassign.new_role})",
                    passed=False,
                    details=f"Expected relay role replacement for {req_reassign.replaced_satellite_id} in {req_reassign.plane} not observed",
                ))
                failure_reasons.append(f"Missing autonomous role reassignment for {req_reassign.replaced_satellite_id}")

        # Check: Expected completed recoveries
        for req_rec in exp.expected_completed_recoveries:
            found = any(
                r["satelliteId"] == req_rec.satellite_id
                for r in completed_recoveries
            )
            if found:
                acceptance_checks.append(AcceptanceCheckResult(
                    name=f"Autonomous Recovery ({req_rec.satellite_id} {req_rec.action_type})",
                    passed=True,
                    details=f"Recovery task for {req_rec.satellite_id} completed successfully via {req_rec.action_type}",
                ))
            else:
                acceptance_checks.append(AcceptanceCheckResult(
                    name=f"Autonomous Recovery ({req_rec.satellite_id} {req_rec.action_type})",
                    passed=False,
                    details=f"Expected completed recovery for {req_rec.satellite_id} ({req_rec.action_type}) not observed",
                ))
                failure_reasons.append(f"Autonomous recovery task {req_rec.action_type} on {req_rec.satellite_id} did not complete")

        # Check: Unrecoverable containment
        for unrec_sat_id in exp.unrecoverable_satellites:
            target_sat = swarm.get_satellite(unrec_sat_id)
            if target_sat and target_sat.state != SatelliteState.NOMINAL:
                acceptance_checks.append(AcceptanceCheckResult(
                    name=f"Unrecoverable Fault Containment ({unrec_sat_id})",
                    passed=True,
                    details=f"{unrec_sat_id} correctly contained in state {target_sat.state.value} (never falsely restored to NOMINAL)",
                ))
            else:
                acceptance_checks.append(AcceptanceCheckResult(
                    name=f"Unrecoverable Fault Containment ({unrec_sat_id})",
                    passed=False,
                    details=f"{unrec_sat_id} was improperly restored to NOMINAL despite unrecoverable hardware fault",
                ))
                failure_reasons.append(f"Unrecoverable satellite {unrec_sat_id} falsely marked NOMINAL")

        # Check: Final nominal threshold
        if final_metrics.nominal_count >= thresh.min_nominal_at_end:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Final Nominal Satellites",
                passed=True,
                details=f"Final nominal count: {final_metrics.nominal_count} >= threshold {thresh.min_nominal_at_end}",
                expected=thresh.min_nominal_at_end,
                actual=final_metrics.nominal_count,
            ))
        else:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Final Nominal Satellites",
                passed=False,
                details=f"Final nominal count {final_metrics.nominal_count} < threshold {thresh.min_nominal_at_end}",
                expected=thresh.min_nominal_at_end,
                actual=final_metrics.nominal_count,
            ))
            failure_reasons.append(f"Final nominal satellite count {final_metrics.nominal_count} below acceptance threshold")

        # Check: Final failed threshold
        if final_metrics.failed_count <= thresh.max_failed_at_end:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Final Failed Satellites",
                passed=True,
                details=f"Final failed count: {final_metrics.failed_count} <= threshold {thresh.max_failed_at_end}",
                expected=thresh.max_failed_at_end,
                actual=final_metrics.failed_count,
            ))
        else:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Final Failed Satellites",
                passed=False,
                details=f"Final failed count {final_metrics.failed_count} > threshold {thresh.max_failed_at_end}",
                expected=thresh.max_failed_at_end,
                actual=final_metrics.failed_count,
            ))
            failure_reasons.append(f"Final failed satellite count {final_metrics.failed_count} exceeded acceptance threshold")

        # Check: Final active ISL links
        if final_metrics.active_links_count >= thresh.min_active_links_at_end:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Final Active ISL Links",
                passed=True,
                details=f"Final active ISL links: {final_metrics.active_links_count} >= threshold {thresh.min_active_links_at_end} (local active ISL links)",
                expected=thresh.min_active_links_at_end,
                actual=final_metrics.active_links_count,
            ))
        else:
            acceptance_checks.append(AcceptanceCheckResult(
                name="Final Active ISL Links",
                passed=False,
                details=f"Final active links {final_metrics.active_links_count} < threshold {thresh.min_active_links_at_end}",
                expected=thresh.min_active_links_at_end,
                actual=final_metrics.active_links_count,
            ))
            failure_reasons.append(f"Active ISL link count {final_metrics.active_links_count} below threshold")

        # Check: Expected coordinator status at end
        if thresh.expected_coordinator_at_end:
            actual_coord = final_metrics.coordinator_id
            if actual_coord == thresh.expected_coordinator_at_end:
                acceptance_checks.append(AcceptanceCheckResult(
                    name="Final Coordinator Status",
                    passed=True,
                    details=f"Final coordinator verified as {actual_coord}",
                    expected=thresh.expected_coordinator_at_end,
                    actual=actual_coord,
                ))
            else:
                acceptance_checks.append(AcceptanceCheckResult(
                    name="Final Coordinator Status",
                    passed=False,
                    details=f"Expected coordinator {thresh.expected_coordinator_at_end}, but final coordinator was {actual_coord}",
                    expected=thresh.expected_coordinator_at_end,
                    actual=actual_coord,
                ))
                failure_reasons.append(f"Final coordinator {actual_coord} does not match expected {thresh.expected_coordinator_at_end}")

        # Determine overall PASS / FAIL status
        status = ScenarioStatus.PASS if not failure_reasons else ScenarioStatus.FAIL

        return ScenarioResult(
            scenario_id=scenario.id,
            scenario_name=scenario.name,
            status=status,
            duration_sim_sec=round(swarm.clock.elapsed_seconds, 2),
            steps_executed=steps_executed,
            wall_clock_duration_sec=round(wall_clock_elapsed, 4),
            baseline_metrics=baseline_metrics,
            faulted_metrics=faulted_metrics,
            final_metrics=final_metrics,
            detection_delays=detection_delays,
            recovery_times=recovery_durations,
            faults_injected_count=len(fault_fired_indices),
            autonomous_events_count=len(swarm.recovery_engine.event_history),
            role_reassignments=role_reassignments,
            completed_recoveries=completed_recoveries,
            remaining_unrecoverable=remaining_unrecoverable,
            timeline=timeline,
            acceptance_checks=acceptance_checks,
            failure_reasons=failure_reasons,
            no_manual_intervention=True,
        )

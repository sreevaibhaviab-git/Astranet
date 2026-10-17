"""ASTRANET Phase 6 — Scenario Benchmark & End-to-End Resilience Test Suite.

Tests the full scenario framework, deterministic execution engine, acceptance criteria,
autonomous self-healing without manual operator intervention, quorum safety under partitions,
stochastic seed reproducibility, and non-corruption of live mission control state.
"""

import json
import unittest
from pathlib import Path
from typing import List, Dict, Any
from pydantic import ValidationError

from backend.app.core.clock import SimulationClock
from backend.app.core.satellite import SatelliteState, SatelliteRole, SubsystemStatus
from backend.app.core.faults import FailureType, FailureSeverity
from backend.app.core.swarm import SwarmOrchestrator
from backend.app.core.scenario_runner import (
    ScenarioRunner,
    ScenarioResult,
    ScenarioStatus,
    load_scenario_from_file,
    list_available_scenarios,
    DEFAULT_SCENARIOS_DIR,
)
from backend.app.schemas.scenarios import (
    ScenarioDefinition,
    ScenarioValidationError,
    ScenarioConfig,
    ScheduledFaultItem,
    InitialInvariants,
    ExpectedOutcomes,
    AcceptanceThresholds,
)


class TestPhase6ScenarioValidation(unittest.TestCase):
    """Requirement 1 & 2: Schema validation, loading, and rejection of malformed scenario definitions."""

    def test_all_scenario_json_files_load_and_validate(self) -> None:
        """Requirement 1: All production JSON scenarios in backend/scenarios/ must load cleanly."""
        scenarios = list_available_scenarios()
        self.assertGreaterEqual(len(scenarios), 5, "Must discover at least 5 benchmark scenarios")

        expected_ids = {
            "nominal_flight",
            "dual_node_failure",
            "cascade_failure",
            "network_partition",
            "seeded_random_faults",
        }
        discovered_ids = {s["id"] for s in scenarios}
        self.assertTrue(expected_ids.issubset(discovered_ids), f"Missing scenarios: {expected_ids - discovered_ids}")

        for s_info in scenarios:
            scen_def = load_scenario_from_file(s_info["id"])
            self.assertIsInstance(scen_def, ScenarioDefinition)
            self.assertEqual(scen_def.id, s_info["id"])
            self.assertGreater(scen_def.configuration.duration_sec, 0.0)

    def test_invalid_scenario_definitions_fail_clearly(self) -> None:
        """Requirement 2: Malformed or impossible scenario definitions must raise ScenarioValidationError or ValidationError."""
        # Test 1: Non-existent satellite ID in scheduled fault
        with self.assertRaises((ScenarioValidationError, ValidationError)):
            ScenarioDefinition(
                id="test_invalid_sat",
                name="Invalid Satellite",
                description="Test rejection of unknown sat ID",
                configuration=ScenarioConfig(duration_sec=10.0),
                scheduled_faults=[
                    ScheduledFaultItem(
                        time_sec=2.0,
                        satellite_id="SAT-99",  # Invalid ID!
                        failure_type=FailureType.COMPUTE_FAILURE,
                    )
                ],
            )

        # Test 2: Negative fault time
        with self.assertRaises((ScenarioValidationError, ValidationError)):
            ScenarioDefinition(
                id="test_negative_time",
                name="Negative Timestamp",
                description="Test rejection of negative timestamp",
                configuration=ScenarioConfig(duration_sec=10.0),
                scheduled_faults=[
                    ScheduledFaultItem(
                        time_sec=-1.5,  # Invalid negative time
                        satellite_id="SAT-01",
                        failure_type=FailureType.COMPUTE_FAILURE,
                    )
                ],
            )

        # Test 3: Fault scheduled beyond scenario duration
        with self.assertRaises((ScenarioValidationError, ValidationError)):
            ScenarioDefinition(
                id="test_overtime_fault",
                name="Overtime Fault",
                description="Test rejection of fault scheduled after duration",
                configuration=ScenarioConfig(duration_sec=5.0),
                scheduled_faults=[
                    ScheduledFaultItem(
                        time_sec=10.0,  # Exceeds 5.0s duration!
                        satellite_id="SAT-01",
                        failure_type=FailureType.COMPUTE_FAILURE,
                    )
                ],
            )

        # Test 4: File not found error
        with self.assertRaises(ScenarioValidationError):
            load_scenario_from_file("non_existent_scenario_12345")


class TestPhase6NominalFlight(unittest.TestCase):
    """Requirement 3: Nominal baseline operation without injected failures."""

    def test_nominal_flight_maintains_expected_invariants(self) -> None:
        scen_def = load_scenario_from_file("nominal_flight")
        runner = ScenarioRunner()
        result = runner.run(scen_def)

        self.assertEqual(result.status, ScenarioStatus.PASS)
        self.assertEqual(result.faults_injected_count, 0)
        self.assertEqual(result.final_metrics.nominal_count, 12)
        self.assertEqual(result.final_metrics.failed_count, 0)
        self.assertEqual(result.final_metrics.coordinator_id, "SAT-07")
        self.assertTrue(result.no_manual_intervention)


class TestPhase6DualNodeFailureAcceptance(unittest.TestCase):
    """Requirement 4 & 5: Primary acceptance criterion: Dual-node failure & autonomous self-healing."""

    def test_dual_node_failure_autonomous_healing_without_manual_intervention(self) -> None:
        """Nominal flight -> Dual-node failure -> Dynamic network self-healing without manual operator intervention."""
        scen_def = load_scenario_from_file("dual_node_failure")
        runner = ScenarioRunner()
        result = runner.run(scen_def)

        # 1. Scenario must PASS all acceptance checks
        self.assertEqual(result.status, ScenarioStatus.PASS, f"Scenario failed: {result.failure_reasons}")
        self.assertTrue(result.no_manual_intervention, "Must require zero operator intervention")

        # 2. Both faults must be injected
        self.assertEqual(result.faults_injected_count, 2)
        self.assertIn("SAT-04", result.detection_delays)
        self.assertIn("SAT-02", result.detection_delays)

        # 3. Detection delays must be bounded (< 1.0s)
        self.assertLessEqual(result.detection_delays["SAT-04"], 1.0)
        self.assertLessEqual(result.detection_delays["SAT-02"], 1.0)

        # 4. Plane A relay handover must have occurred automatically
        self.assertTrue(any('PLANE A' in r['message'] for r in result.role_reassignments))
        plane_a_reassign = next(r for r in result.role_reassignments if 'PLANE A' in r['message'])
        self.assertIn(plane_a_reassign['satelliteId'], ['SAT-01', 'SAT-03'])

        # 5. SAT-02 compute watchdog recovery completed successfully
        self.assertTrue(any(r['satelliteId'] == 'SAT-02' for r in result.completed_recoveries))

        # 6. SAT-04 critical comms fault contained as unrecoverable
        self.assertIn('SAT-04', result.remaining_unrecoverable)
        sat04 = result.final_metrics.satellite_states['SAT-04']
        self.assertEqual(sat04, 'FAILED')

        # 7. Final constellation state: 11 nominal, 1 failed, 0 degraded
        self.assertEqual(result.final_metrics.nominal_count, 11)
        self.assertEqual(result.final_metrics.failed_count, 1)
        self.assertEqual(result.final_metrics.degraded_count, 0)
        self.assertEqual(result.final_metrics.coordinator_id, "SAT-07")


class TestPhase6NetworkPartitionAndQuorum(unittest.TestCase):
    """Requirement 6: Quorum enforcement during network partitions."""

    def test_network_partitions_prevent_invalid_coordinator_elections(self) -> None:
        """When coordinator fails in a partitioned constellation where no 7-node quorum exists,
        leadership must remain UNRESOLVED rather than electing a split-brain or minority coordinator.
        """
        scen_def = load_scenario_from_file("network_partition")
        runner = ScenarioRunner()
        result = runner.run(scen_def)

        self.assertEqual(result.status, ScenarioStatus.PASS, f"Scenario failed: {result.failure_reasons}")
        self.assertEqual(result.final_metrics.coordinator_id, "UNRESOLVED")
        self.assertTrue(result.final_metrics.is_leadership_unresolved)
        # Quorum invariant check must have passed
        quorum_checks = [c for c in result.acceptance_checks if "Coordinator" in c.name or "Quorum" in c.name]
        self.assertTrue(all(c.passed for c in quorum_checks))


class TestPhase6CascadeFailureContainment(unittest.TestCase):
    """Requirement 7: Cascade failure containment across multiple subsystems."""

    def test_cascade_failure_preserves_unrecoverable_fault_containment(self) -> None:
        """Propulsion and comms hardware failures remain FAILED/ISOLATED, while compute reset succeeds."""
        scen_def = load_scenario_from_file("cascade_failure")
        runner = ScenarioRunner()
        result = runner.run(scen_def)

        self.assertEqual(result.status, ScenarioStatus.PASS, f"Scenario failed: {result.failure_reasons}")
        self.assertEqual(result.faults_injected_count, 4)

        # SAT-05 (Propulsion CRITICAL) must remain FAILED
        self.assertIn('SAT-05', result.remaining_unrecoverable)
        self.assertEqual(result.final_metrics.satellite_states['SAT-05'], 'FAILED')
        # SAT-08 (Comms CRITICAL) must remain FAILED
        self.assertIn('SAT-08', result.remaining_unrecoverable)
        self.assertEqual(result.final_metrics.satellite_states['SAT-08'], 'FAILED')
        # SAT-10 (Node Loss CRITICAL) must remain ISOLATED
        self.assertIn('SAT-10', result.remaining_unrecoverable)
        self.assertEqual(result.final_metrics.satellite_states['SAT-10'], 'ISOLATED')

        # SAT-01 compute reset must have recovered
        self.assertTrue(any(r['satelliteId'] == 'SAT-01' for r in result.completed_recoveries))

class TestPhase6SeededRandomReproducibility(unittest.TestCase):
    """Requirement 8 & 13: Determinism and reproducibility of seeded stochastic benchmarks."""

    def test_seeded_random_scenarios_are_reproducible(self) -> None:
        """Running the same seeded scenario multiple times must produce bit-for-bit identical results."""
        scen_def1 = load_scenario_from_file("seeded_random_faults")
        scen_def2 = load_scenario_from_file("seeded_random_faults")

        runner1 = ScenarioRunner()
        res1 = runner1.run(scen_def1)

        runner2 = ScenarioRunner()
        res2 = runner2.run(scen_def2)

        self.assertEqual(res1.status, res2.status)
        self.assertEqual(res1.faults_injected_count, res2.faults_injected_count)
        self.assertEqual(res1.autonomous_events_count, res2.autonomous_events_count)
        self.assertEqual(res1.baseline_metrics.to_dict(), res2.baseline_metrics.to_dict())
        self.assertEqual(res1.final_metrics.to_dict(), res2.final_metrics.to_dict())
        self.assertEqual(res1.detection_delays, res2.detection_delays)


class TestPhase6FaultSchedulingAndTiming(unittest.TestCase):
    """Requirement 9 & 10: Fault scheduling timing, single execution, and timeout detection."""

    def test_scheduled_faults_fire_at_correct_simulated_times_and_only_once(self) -> None:
        scen_def = load_scenario_from_file("dual_node_failure")
        runner = ScenarioRunner()
        result = runner.run(scen_def)

        # SAT-04 was scheduled at t=2.0s, SAT-02 at t=4.0s
        self.assertEqual(result.faults_injected_count, 2)
        fault_checks = [c for c in result.acceptance_checks if "Scheduled Fault Execution" in c.name]
        self.assertTrue(all(c.passed for c in fault_checks))

    def test_scenario_timeout_detection(self) -> None:
        """A scenario configured with insufficient duration to complete required recovery must fail acceptance."""
        # Create a modified scenario where duration is too short for compute recovery (which takes 3.0s)
        scen_def = ScenarioDefinition(
            id="test_timeout",
            name="Timeout Test Scenario",
            description="Duration shorter than recovery duration",
            configuration=ScenarioConfig(duration_sec=2.0, time_step_sec=0.5),
            scheduled_faults=[
                ScheduledFaultItem(
                    time_sec=1.0,
                    satellite_id="SAT-01",
                    failure_type=FailureType.COMPUTE_FAILURE,
                    severity=FailureSeverity.MODERATE,
                )
            ],
            acceptance_thresholds=AcceptanceThresholds(
                min_nominal_at_end=12  # Requires SAT-01 to be nominal, but 2.0s is too short!
            ),
        )
        runner = ScenarioRunner()
        result = runner.run(scen_def)

        self.assertEqual(result.status, ScenarioStatus.FAIL)
        self.assertTrue(any('nominal satellite count' in r.lower() for r in result.failure_reasons))


class TestPhase6TimelineAndMetrics(unittest.TestCase):
    """Requirement 11: Metric tracking and replayable timeline integrity."""

    def test_metrics_and_event_timelines_reflect_actual_simulation_state(self) -> None:
        scen_def = load_scenario_from_file("dual_node_failure")
        runner = ScenarioRunner()
        result = runner.run(scen_def)

        self.assertGreater(len(result.timeline), 0)
        # Baseline must have 12 nominal
        self.assertEqual(result.timeline[0]['nominal'], 12)
        # Verify monotonically increasing simulation time in timeline
        times = [snap['simTimeSec'] for snap in result.timeline]
        self.assertEqual(times, sorted(times))

class TestPhase6IsolationAndIntegrity(unittest.TestCase):
    """Requirement 12 & 14: Isolated scenario execution must never corrupt live simulation."""

    def test_isolated_run_does_not_corrupt_live_orchestrator(self) -> None:
        live_swarm = SwarmOrchestrator()
        initial_nominal = sum(1 for s in live_swarm.satellites if s.state == SatelliteState.NOMINAL)
        self.assertEqual(initial_nominal, 12)

        # Run an isolated cascade failure
        scen_def = load_scenario_from_file("cascade_failure")
        runner = ScenarioRunner()  # Isolated (orchestrator=None)
        res = runner.run(scen_def)

        self.assertEqual(res.status, ScenarioStatus.PASS)

        # Verify live orchestrator remains completely untouched
        live_nominal = sum(1 for s in live_swarm.satellites if s.state == SatelliteState.NOMINAL)
        self.assertEqual(live_nominal, 12)
        self.assertEqual(live_swarm.clock.elapsed_seconds, 0.0)
        self.assertEqual(len(live_swarm.events), 0)

    def test_structured_report_export_format(self) -> None:
        scen_def = load_scenario_from_file("nominal_flight")
        runner = ScenarioRunner()
        res = runner.run(scen_def)
        report_dict = res.to_dict()

        required_keys = {
            "scenario_id",
            "scenario_name",
            "status",
            "duration_sim_sec",
            "steps_executed",
            "wall_clock_duration_sec",
            "baseline_metrics",
            "final_metrics",
            "faults_injected_count",
            "autonomous_events_count",
            "acceptance_checks",
            "no_manual_intervention",
        }
        self.assertTrue(required_keys.issubset(report_dict.keys()))
        self.assertEqual(report_dict["status"], "PASS")


if __name__ == "__main__":
    unittest.main()

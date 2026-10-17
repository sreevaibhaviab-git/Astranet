"""ASTRANET Phase 6 — Scenario Benchmark CLI Runner.

CLI Entry Point for listing, running, benchmarking, and exporting scenario results.

Usage:
    py -3 -m backend.app.run_scenario --list
    py -3 -m backend.app.run_scenario --scenario dual_node_failure
    py -3 -m backend.app.run_scenario --all
    py -3 -m backend.app.run_scenario --scenario seeded_random_faults --repeat 3
    py -3 -m backend.app.run_scenario --all --export reports/benchmark_phase6.json
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List, Dict, Any

from backend.app.core.scenario_runner import (
    ScenarioRunner,
    ScenarioResult,
    ScenarioStatus,
    list_available_scenarios,
    load_scenario_from_file,
)
from backend.app.schemas.scenarios import ScenarioValidationError


def print_scenario_list() -> None:
    """Print formatted list of available scenario benchmarks."""
    scenarios = list_available_scenarios()
    print("=" * 80)
    print(f"{'ASTRANET PHASE 6 BENCHMARK SCENARIOS':^80}")
    print("=" * 80)
    print(f"{'ID':<24} {'NAME':<36} {'DURATION':<10} {'FAULTS'}")
    print("-" * 80)
    for s in scenarios:
        duration_str = f"{s['durationSec']}s"
        stochastic_tag = " (stochastic)" if s.get("isStochastic") else ""
        faults_str = f"{s['faultCount']}{stochastic_tag}"
        print(f"{s['id']:<24} {s['name'][:35]:<36} {duration_str:<10} {faults_str}")
    print("=" * 80)
    print(f"Total scenarios available: {len(scenarios)}")


def run_single_scenario(scenario_id: str, quiet: bool = False) -> ScenarioResult:
    """Execute a single scenario by ID or filepath."""
    try:
        scen_def = load_scenario_from_file(scenario_id)
    except ScenarioValidationError as e:
        print(f"Error loading scenario '{scenario_id}': {e}", file=sys.stderr)
        sys.exit(1)

    runner = ScenarioRunner()
    result = runner.run(scen_def)
    if not quiet:
        print(result.to_summary_table())
        print()
    return result


def run_all_scenarios(quiet: bool = False) -> List[ScenarioResult]:
    """Execute all discovered scenarios and return list of results."""
    scenarios = list_available_scenarios()
    if not quiet:
        print("=" * 80)
        print(f"EXECUTING {len(scenarios)} BENCHMARK SCENARIOS")
        print("=" * 80)
        print()

    results: List[ScenarioResult] = []
    runner = ScenarioRunner()
    for s in scenarios:
        scen_def = load_scenario_from_file(s["id"])
        res = runner.run(scen_def)
        results.append(res)
        if not quiet:
            print(res.to_summary_table())
            print()

    # Benchmark summary table
    if not quiet:
        print("=" * 80)
        print(f"{'BENCHMARK SUITE SUMMARY':^80}")
        print("=" * 80)
        print(f"{'SCENARIO ID':<26} {'STATUS':<10} {'DURATION':<12} {'FAULTS':<8} {'EVENTS'}")
        print("-" * 80)
        all_passed = True
        for r in results:
            if r.status != ScenarioStatus.PASS:
                all_passed = False
            duration_str = f"{r.duration_sim_sec:.1f}s ({r.steps_executed} steps)"
            print(f"{r.scenario_id:<26} {r.status.value:<10} {duration_str:<12} {r.faults_injected_count:<8} {r.autonomous_events_count}")
        print("=" * 80)
        overall_tag = "ALL BENCHMARKS PASSED [PASS]" if all_passed else "SOME BENCHMARKS FAILED [FAIL]"
        print(f"Overall Result: {overall_tag}")
        print("=" * 80)

    return results


def repeat_and_compare(scenario_id: str, count: int) -> bool:
    """Run a scenario multiple times to verify determinism and repeatability."""
    print("=" * 80)
    print(f"REPETITION & REPRODUCIBILITY TEST: {scenario_id} ({count} runs)")
    print("=" * 80)

    results: List[ScenarioResult] = []
    runner = ScenarioRunner()
    for i in range(count):
        scen_def = load_scenario_from_file(scenario_id)
        res = runner.run(scen_def)
        results.append(res)
        print(f"  Run {i + 1}/{count}: Status={res.status.value}, Faults={res.faults_injected_count}, Events={res.autonomous_events_count}, WallClock={res.wall_clock_duration_sec:.4f}s")

    # Compare key metrics across runs for exact determinism
    first = results[0]
    identical = True
    for idx, r in enumerate(results[1:], start=2):
        if r.status != first.status:
            print(f"  [DIVERGENCE] Run {idx} status {r.status.value} != {first.status.value}")
            identical = False
        if r.faults_injected_count != first.faults_injected_count:
            print(f"  [DIVERGENCE] Run {idx} faults {r.faults_injected_count} != {first.faults_injected_count}")
            identical = False
        if r.autonomous_events_count != first.autonomous_events_count:
            print(f"  [DIVERGENCE] Run {idx} events {r.autonomous_events_count} != {first.autonomous_events_count}")
            identical = False
        if r.baseline_metrics.to_dict() != first.baseline_metrics.to_dict():
            print(f"  [DIVERGENCE] Run {idx} baseline metrics do not match Run 1")
            identical = False
        if r.final_metrics.to_dict() != first.final_metrics.to_dict():
            print(f"  [DIVERGENCE] Run {idx} final metrics do not match Run 1")
            identical = False

    print("-" * 80)
    if identical:
        print(f"[REPRODUCIBILITY CONFIRMED] All {count} runs produced identical deterministic state transitions and metrics.")
    else:
        print(f"[DIVERGENCE DETECTED] Runs produced non-deterministic outcomes.")
    print("=" * 80)
    return identical


def export_results_to_json(results: List[ScenarioResult], output_path: str) -> None:
    """Export benchmark results to structured JSON report."""
    target_path = Path(output_path)
    target_path.parent.mkdir(parents=True, exist_ok=True)

    report: Dict[str, Any] = {
        "benchmark_suite": "ASTRANET Phase 6 End-to-End Validation",
        "scenarios_executed": len(results),
        "overall_status": "PASS" if all(r.status == ScenarioStatus.PASS for r in results) else "FAIL",
        "results": [r.to_dict() for r in results],
    }

    with open(target_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Report exported successfully to: {target_path.resolve()}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="ASTRANET Phase 6 Scenario Benchmark Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--list", action="store_true", help="List all available scenario benchmarks")
    group.add_argument("--scenario", type=str, help="ID or file path of scenario to run")
    group.add_argument("--all", action="store_true", help="Run the complete benchmark suite")

    parser.add_argument("--repeat", type=int, default=1, help="Number of times to repeat scenario for determinism test")
    parser.add_argument("--export", type=str, default="", help="Path to write JSON benchmark report")
    parser.add_argument("--json", action="store_true", help="Output raw JSON result to stdout")

    args = parser.parse_args()

    if args.list:
        print_scenario_list()
        return 0

    if args.scenario:
        if args.repeat > 1:
            reproducible = repeat_and_compare(args.scenario, args.repeat)
            return 0 if reproducible else 1

        result = run_single_scenario(args.scenario, quiet=args.json)
        if args.json:
            print(json.dumps(result.to_dict(), indent=2))
        if args.export:
            export_results_to_json([result], args.export)
        return 0 if result.status == ScenarioStatus.PASS else 1

    if args.all:
        results = run_all_scenarios(quiet=args.json)
        if args.json:
            report = {
                "benchmark_suite": "ASTRANET Phase 6 End-to-End Validation",
                "scenarios_executed": len(results),
                "overall_status": "PASS" if all(r.status == ScenarioStatus.PASS for r in results) else "FAIL",
                "results": [r.to_dict() for r in results],
            }
            print(json.dumps(report, indent=2))
        if args.export:
            export_results_to_json(results, args.export)
        return 0 if all(r.status == ScenarioStatus.PASS for r in results) else 1

    return 0


if __name__ == "__main__":
    sys.exit(main())

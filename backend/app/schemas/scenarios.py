"""ASTRANET Phase 6 — Pydantic Schemas and Data Models for Scenario Definitions."""

from typing import List, Optional, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field, field_validator, model_validator

from backend.app.core.faults import FailureType, FailureSeverity

VALID_SATELLITE_IDS = {f"SAT-{i:02d}" for i in range(1, 13)}


class ScenarioValidationError(Exception):
    """Raised when a scenario JSON definition fails validation rules."""
    pass


class ScenarioConfiguration(BaseModel):
    """Runtime physics and timing settings for scenario execution."""
    duration_sec: float = Field(..., gt=0.0, description="Total simulation duration in seconds")
    time_step_sec: float = Field(0.5, gt=0.0, description="Simulation delta-t per tick in seconds")
    time_warp: float = Field(1.0, gt=0.0, description="Time warp multiplier")
    max_isl_range_m: float = Field(5_000_000.0, gt=0.0, description="Maximum inter-satellite link range in meters")
    random_seed: Optional[int] = Field(None, description="Optional deterministic seed for stochastic faults")


ScenarioConfig = ScenarioConfiguration


class ScheduledFaultItem(BaseModel):
    """Single timed fault injection instruction."""
    time_sec: float = Field(..., ge=0.0, description="Simulation timestamp in seconds when fault occurs")
    satellite_id: str = Field(..., description="Target satellite identifier (SAT-01 to SAT-12)")
    failure_type: FailureType = Field(..., description="Specific failure category")
    severity: FailureSeverity = Field(FailureSeverity.CRITICAL, description="Failure severity")
    description: Optional[str] = Field(None, description="Operator annotation")

    @field_validator("satellite_id")
    @classmethod
    def validate_satellite_id(cls, v: str) -> str:
        if v not in VALID_SATELLITE_IDS:
            raise ValueError(f"Invalid satellite ID '{v}'. Must be one of {sorted(VALID_SATELLITE_IDS)}")
        return v


class StochasticCandidateFailure(BaseModel):
    """Candidate failure mode for pseudo-random fault generator."""
    type: FailureType
    severity: FailureSeverity


class StochasticFaultGenerator(BaseModel):
    """Deterministic pseudo-random fault generator configuration."""
    count: int = Field(..., ge=1)
    min_time_sec: float = Field(..., ge=0.0)
    max_time_sec: float = Field(..., gt=0.0)
    candidate_satellites: List[str]
    candidate_failures: List[StochasticCandidateFailure]

    @field_validator("candidate_satellites")
    @classmethod
    def validate_satellites(cls, sats: List[str]) -> List[str]:
        for s in sats:
            if s not in VALID_SATELLITE_IDS:
                raise ValueError(f"Invalid candidate satellite ID '{s}'")
        return sats

    @model_validator(mode="after")
    def validate_time_bounds(self) -> "StochasticFaultGenerator":
        if self.min_time_sec >= self.max_time_sec:
            raise ValueError(f"min_time_sec ({self.min_time_sec}) must be less than max_time_sec ({self.max_time_sec})")
        return self


class InitialInvariants(BaseModel):
    """Constellation invariants required at simulation start."""
    min_nominal_satellites: int = Field(12, ge=1, le=12)
    expected_coordinator: Optional[str] = "SAT-07"
    expected_relays: List[str] = Field(default_factory=lambda: ["SAT-04", "SAT-08", "SAT-12"])


class ExpectedRoleReassignment(BaseModel):
    """Expected autonomous role reassignment specification."""
    plane: str
    new_role: str
    replaced_satellite_id: str


class ExpectedCompletedRecovery(BaseModel):
    """Expected autonomous recovery task completion."""
    satellite_id: str
    action_type: str


class ExpectedOutcomes(BaseModel):
    """Autonomous recovery milestones and constraints."""
    max_detection_delay_sec: float = Field(2.0, ge=0.0)
    expected_role_reassignments: List[ExpectedRoleReassignment] = Field(default_factory=list)
    expected_completed_recoveries: List[ExpectedCompletedRecovery] = Field(default_factory=list)
    unrecoverable_satellites: List[str] = Field(default_factory=list)
    allowed_unresolved_conditions: List[str] = Field(default_factory=list)
    require_no_manual_intervention: bool = True


class AcceptanceThresholds(BaseModel):
    """Quantitative thresholds evaluated at the end of scenario execution."""
    min_nominal_at_end: int = Field(0, ge=0, le=12)
    max_failed_at_end: int = Field(12, ge=0, le=12)
    max_degraded_at_end: int = Field(12, ge=0, le=12)
    min_active_links_at_end: int = Field(0, ge=0)
    expected_coordinator_at_end: Optional[str] = None


class ScenarioDefinition(BaseModel):
    """Complete root model for an ASTRANET benchmark scenario."""
    version: str = Field("1.0.0", description="Scenario specification format version")
    id: str = Field(..., description="Unique slug ID (e.g. 'dual_node_failure')")
    name: str = Field(..., description="Human-readable title")
    description: str = Field(..., description="Detailed objective and verification description")
    configuration: ScenarioConfiguration
    initial_invariants: InitialInvariants = Field(default_factory=InitialInvariants)
    stochastic_fault_generator: Optional[StochasticFaultGenerator] = None
    scheduled_faults: List[ScheduledFaultItem] = Field(default_factory=list)
    expected_outcomes: ExpectedOutcomes = Field(default_factory=ExpectedOutcomes)
    acceptance_thresholds: AcceptanceThresholds = Field(default_factory=AcceptanceThresholds)

    @model_validator(mode="after")
    def validate_fault_timestamps(self) -> "ScenarioDefinition":
        dur = self.configuration.duration_sec
        for idx, f in enumerate(self.scheduled_faults):
            if f.time_sec > dur:
                raise ValueError(
                    f"Scheduled fault #{idx + 1} timestamp {f.time_sec}s exceeds scenario duration {dur}s"
                )
        return self

"""ASTRANET — Pydantic Command and Control Request/Response Schemas."""

from typing import Optional, Any
from pydantic import BaseModel, Field

from backend.app.core.faults import FailureType, FailureSeverity


class StepCommand(BaseModel):
    """Command payload to advance simulation by a discrete time step."""
    dt: Optional[float] = Field(None, ge=0.0, description="Explicit step size in seconds. Defaults to clock default.")


class WarpCommand(BaseModel):
    """Command payload to modify time acceleration factor."""
    warpFactor: float = Field(..., ge=0.0, description="Time multiplier (e.g. 1.0 = real-time, 60.0 = demo mode)")


class FaultInjectionCommand(BaseModel):
    """Command payload to inject an operational fault into a target spacecraft."""
    targetSatelliteId: str = Field(..., description="Target spacecraft identifier, e.g. 'SAT-04'")
    failureType: FailureType = Field(..., description="Failure category")
    severity: FailureSeverity = Field(FailureSeverity.CRITICAL, description="Failure severity")
    description: Optional[str] = Field(None, description="Optional custom operator annotation")


class ResetCommand(BaseModel):
    """Command payload to reset simulation to initial epoch."""
    initialElapsedSec: float = Field(0.0, ge=0.0, description="Initial elapsed time to start from")


class ApiResponse(BaseModel):
    """Generic structured API response."""
    success: bool
    message: str
    data: Optional[Any] = None

"""ASTRANET — Pydantic Telemetry Schemas.

Defines typed Pydantic models strictly reflecting the Phase 1 & 2 data model
and conforming to the frontend TypeScript SatelliteTelemetry interfaces in mockMissionControl.ts.
"""

from typing import List, Tuple, Dict, Any, Optional
from pydantic import BaseModel, Field


class ClockTelemetry(BaseModel):
    """Simulation clock state telemetry."""
    epochSec: float = Field(..., description="Current simulated UTC Unix timestamp in seconds")
    elapsedSec: float = Field(..., description="Mission elapsed time in seconds")
    timeString: str = Field(..., description="Formatted mission elapsed time HH:MM:SS")
    utcString: str = Field(..., description="Formatted UTC timestamp HH:MM:SS UTC")
    warpFactor: float = Field(..., ge=0.0, description="Time acceleration factor")
    isPaused: bool = Field(..., description="Simulation pause status")
    ticks: int = Field(..., description="Total discrete steps executed")


class PositionSchema(BaseModel):
    """Spacecraft 3D position vector in ECI kilometers and spherical geographic coordinates."""
    x: float = Field(..., description="ECI X position in kilometers")
    y: float = Field(..., description="ECI Y position in kilometers")
    z: float = Field(..., description="ECI Z position in kilometers")
    lat: float = Field(..., ge=-90.0, le=90.0, description="Geodetic latitude in degrees")
    lon: float = Field(..., ge=-180.0, le=180.0, description="Geographic longitude in degrees")
    altKm: float = Field(..., description="Geometric altitude in kilometers above mean Earth")


class VelocitySchema(BaseModel):
    """Spacecraft 3D velocity vector in ECI kilometers per second."""
    vx: float = Field(..., description="ECI X velocity in km/s")
    vy: float = Field(..., description="ECI Y velocity in km/s")
    vz: float = Field(..., description="ECI Z velocity in km/s")
    speedKmS: float = Field(..., ge=0.0, description="Total orbital speed in km/s")


class SubsystemsSchema(BaseModel):
    """Health statuses of onboard spacecraft subsystems."""
    communications: str
    navigation: str
    propulsion: str
    power: str
    payload: str
    attitudeControl: str
    compute: str


class CapabilitiesSchema(BaseModel):
    """Functional capability flags."""
    sensing: bool
    relay: bool
    navigation: bool
    compute: bool
    storage: bool
    maneuvering: bool


class NetworkMetricsSchema(BaseModel):
    """Local RF network node telemetry."""
    neighbors: int = Field(..., ge=0)
    latencyMs: float = Field(..., ge=0.0)
    packetLoss: float = Field(..., ge=0.0)
    linkQuality: float = Field(..., ge=0.0)
    localEpoch: int


class SatelliteTelemetrySchema(BaseModel):
    """Full telemetry frame for an individual CubeSat agent."""
    id: str
    name: str
    plane: str
    planeIndex: int = Field(..., ge=0, le=2)
    slot: str
    slotIndex: int = Field(..., ge=0, le=3)
    state: str
    role: str
    altitudeKm: float
    inclinationDeg: float
    phaseDeg: float
    orbitPeriodSec: float
    position: PositionSchema
    velocity: VelocitySchema
    battery: float = Field(..., ge=0.0, le=100.0)
    propellant: float = Field(..., ge=0.0, le=100.0)
    compute: float = Field(..., ge=0.0, le=100.0)
    storage: float = Field(..., ge=0.0, le=100.0)
    trust: float = Field(..., ge=0.0, le=1.0)
    subsystems: SubsystemsSchema
    capabilities: CapabilitiesSchema
    network: NetworkMetricsSchema
    autonomyStatus: str
    missionState: str
    lastAnomaly: Optional[str] = None


class NetworkSummarySchema(BaseModel):
    """Constellation-wide communication topology metrics."""
    activeLinks: int = Field(..., ge=0)
    connected: bool
    partitionCount: int = Field(..., ge=0)
    averageLatencyMs: float = Field(..., ge=0.0)
    maxRangeKm: float = Field(..., ge=0.0)


class MissionEventSchema(BaseModel):
    """Operational or anomaly mission event record."""
    id: str
    timestamp: str
    type: str
    category: str
    satelliteId: Optional[str] = None
    severity: str
    message: str
    failureType: Optional[str] = None
    failureSeverity: Optional[str] = None


class SwarmSummarySchema(BaseModel):
    """Swarm-level operational summary."""
    total: int
    nominal: int
    degraded: int
    failed: int
    coordinatorId: str
    missionCode: str
    missionState: str


class TelemetryFrameSchema(BaseModel):
    """Complete consolidated telemetry frame broadcast by the simulation backend."""
    clock: ClockTelemetry
    satellites: List[SatelliteTelemetrySchema]
    links: List[Tuple[str, str]]
    network: NetworkSummarySchema
    events: List[MissionEventSchema]
    swarmSummary: SwarmSummarySchema

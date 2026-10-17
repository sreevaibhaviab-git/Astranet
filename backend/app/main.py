"""ASTRANET — FastAPI Simulation Backend and Live Telemetry Streaming Server.

Exposes the core CubeSat swarm simulation engine, dynamic ISL communication graph,
and physical fault injection interface via REST endpoints and a high-frequency (10 Hz)
WebSocket live telemetry stream.
"""

from contextlib import asynccontextmanager
import asyncio
from typing import Set, List, Dict, Any, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.swarm import SwarmOrchestrator
from backend.app.schemas.telemetry import (
    TelemetryFrameSchema,
    MissionEventSchema,
)
from backend.app.schemas.commands import (
    StepCommand,
    WarpCommand,
    FaultInjectionCommand,
    ResetCommand,
    ApiResponse,
)


# Global Swarm Orchestrator Instance (Authoritative Source of Simulation State)
orchestrator = SwarmOrchestrator(
    altitude_m=550_000.0,
    enable_j2=False,
    max_isl_range_m=5_000_000.0,
)

# Simulation Timing Configuration
# PUBLICATION_INTERVAL_SEC: Real wall-clock broadcast interval (0.1s = 10 Hz)
PUBLICATION_INTERVAL_SEC: float = 0.1
# AUTO_ADVANCE_ENABLED: When True, background loop advances physics by (interval * warp)
AUTO_ADVANCE_ENABLED: bool = True


class ConnectionManager:
    """Manages active WebSocket telemetry streaming clients."""

    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()
        self._lock: asyncio.Lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self.active_connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self.active_connections.discard(websocket)

    async def broadcast(self, message: Dict[str, Any]) -> None:
        async with self._lock:
            dead_connections: List[WebSocket] = []
            for connection in self.active_connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.append(connection)

            for dead in dead_connections:
                self.active_connections.discard(dead)


manager = ConnectionManager()
_background_task: Optional[asyncio.Task] = None


async def simulation_streaming_loop() -> None:
    """Asynchronous background loop for physics advancement and telemetry broadcast.

    Timing Model:
        Wall-clock frequency: 10 Hz (PUBLICATION_INTERVAL_SEC = 0.1s).
        Physics delta-t per tick:
            - If clock is paused: dt = 0.0s (no motion, latest frame broadcast).
            - If active: dt = PUBLICATION_INTERVAL_SEC (scaled by clock's warp_factor).
    """
    try:
        while True:
            # 1. Advance simulation step if active
            if AUTO_ADVANCE_ENABLED and not orchestrator.clock.is_paused:
                orchestrator.step(dt=PUBLICATION_INTERVAL_SEC)

            # 2. Assemble current telemetry frame
            frame = orchestrator.get_telemetry_frame()

            # 3. Broadcast to all connected WebSocket clients
            if manager.active_connections:
                await manager.broadcast(frame)

            await asyncio.sleep(PUBLICATION_INTERVAL_SEC)
    except asyncio.CancelledError:
        # Graceful task cancellation during shutdown
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager ensuring a single controlled background streaming task."""
    global _background_task
    # Startup: Launch background simulation streaming loop
    _background_task = asyncio.create_task(simulation_streaming_loop())
    yield
    # Shutdown: Cleanly cancel background streaming loop
    if _background_task and not _background_task.done():
        _background_task.cancel()
        try:
            await _background_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="ASTRANET Mission Simulation Backend",
    description="Autonomous Self-Healing CubeSat Swarm Simulation API and Live Telemetry Stream",
    version="0.1.0",
    lifespan=lifespan,
)

# Local Development CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ============================================================================
# HTTP REST ENDPOINTS
# ============================================================================

@app.get("/health")
def get_health() -> Dict[str, Any]:
    """Health check returning server status, constellation metrics, and clock state."""
    return {
        "status": "ok",
        "service": "ASTRANET-Simulation-Engine",
        "version": "0.1.0",
        "swarmTotal": orchestrator.satellite_count,
        "activeLinks": orchestrator.network.active_link_count,
        "isPaused": orchestrator.clock.is_paused,
        "warpFactor": orchestrator.clock.warp_factor,
        "elapsedSec": orchestrator.clock.elapsed_seconds,
    }


@app.get("/api/state", response_model=TelemetryFrameSchema)
def get_current_state() -> Dict[str, Any]:
    """Retrieve the authoritative simulation state and constellation telemetry frame."""
    return orchestrator.get_telemetry_frame()


@app.post("/api/simulation/step", response_model=TelemetryFrameSchema)
def step_simulation(cmd: Optional[StepCommand] = None) -> Dict[str, Any]:
    """Manually advance the simulation by a discrete controlled time step."""
    dt = cmd.dt if cmd and cmd.dt is not None else None
    orchestrator.step(dt)
    return orchestrator.get_telemetry_frame()


@app.post("/api/simulation/pause", response_model=ApiResponse)
def pause_simulation() -> ApiResponse:
    """Pause continuous simulation time advancement."""
    orchestrator.clock.pause()
    return ApiResponse(
        success=True,
        message="Simulation advancement paused",
        data={"isPaused": orchestrator.clock.is_paused},
    )


@app.post("/api/simulation/resume", response_model=ApiResponse)
def resume_simulation() -> ApiResponse:
    """Resume continuous simulation time advancement."""
    orchestrator.clock.resume()
    return ApiResponse(
        success=True,
        message="Simulation advancement resumed",
        data={"isPaused": orchestrator.clock.is_paused},
    )


@app.post("/api/simulation/warp", response_model=ApiResponse)
def set_time_warp(cmd: WarpCommand) -> ApiResponse:
    """Set the simulation time acceleration warp factor."""
    try:
        orchestrator.clock.set_warp(cmd.warpFactor)
        return ApiResponse(
            success=True,
            message=f"Time warp factor set to {cmd.warpFactor}x",
            data={"warpFactor": orchestrator.clock.warp_factor},
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@app.post("/api/simulation/reset", response_model=TelemetryFrameSchema)
def reset_simulation(cmd: Optional[ResetCommand] = None) -> Dict[str, Any]:
    """Restore baseline constellation initial conditions, clearing all active faults."""
    initial_sec = cmd.initialElapsedSec if cmd else 0.0
    orchestrator.reset(initial_elapsed_sec=initial_sec)
    return orchestrator.get_telemetry_frame()


@app.post("/api/simulation/fault", response_model=MissionEventSchema)
def inject_fault(cmd: FaultInjectionCommand) -> Dict[str, Any]:
    """Inject an anomaly into a target spacecraft and recompute constellation topology."""
    try:
        event = orchestrator.inject_fault(
            target_satellite_id=cmd.targetSatelliteId,
            failure_type=cmd.failureType,
            severity=cmd.severity,
            description=cmd.description,
        )
        return event.to_dict()
    except KeyError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@app.get("/api/events", response_model=List[MissionEventSchema])
def get_events() -> List[Dict[str, Any]]:
    """Retrieve chronological history of all recorded fault and mission events."""
    return [ev.to_dict() for ev in reversed(orchestrator.events)]


# ============================================================================
# PHASE 6 SCENARIOS BENCHMARK ENDPOINTS
# ============================================================================

from backend.app.core.scenario_runner import (
    ScenarioRunner,
    list_available_scenarios,
    load_scenario_from_file,
)
from backend.app.schemas.scenarios import ScenarioValidationError


@app.get("/api/scenarios")
def get_scenarios() -> List[Dict[str, Any]]:
    """List all available Phase 6 benchmark scenarios."""
    return list_available_scenarios()


@app.post("/api/scenarios/run/{scenario_id}")
def run_scenario_endpoint(scenario_id: str) -> Dict[str, Any]:
    """Execute a scenario in an isolated orchestrator without mutating the live stream."""
    try:
        scen_def = load_scenario_from_file(scenario_id)
    except ScenarioValidationError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    runner = ScenarioRunner()
    result = runner.run(scen_def)
    return result.to_dict()


# ============================================================================
# WEBSOCKET STREAMING ENDPOINT
# ============================================================================

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket) -> None:
    """Live high-frequency telemetry stream broadcasting consolidated JSON frames."""
    await manager.connect(websocket)
    try:
        # Send initial immediate snapshot upon successful handshake
        initial_frame = orchestrator.get_telemetry_frame()
        await websocket.send_json(initial_frame)

        # Keep connection open and await optional client heartbeat/ping
        while True:
            # Non-blocking receive for client control messages / ping
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)

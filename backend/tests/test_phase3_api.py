"""ASTRANET Phase 3 — FastAPI REST and WebSocket API Test Suite.

Tests:
1. GET /health: Health check, service status, swarm count, and clock state.
2. GET /api/state: Complete constellation telemetry frame validation.
3. POST /api/simulation/step: Manual step advancement.
4. POST /api/simulation/pause and resume: Clock pause control.
5. POST /api/simulation/warp: Time warp factor updates and validation.
6. POST /api/simulation/reset: Constellation baseline restoration.
7. POST /api/simulation/fault (Valid): Successfully injects fault and logs event.
8. POST /api/simulation/fault (Unknown ID): Returns 404 with meaningful detail.
9. GET /api/events: Returns chronological history of events.
10. WebSocket /ws/telemetry: Connects, receives valid initial frame, and handles clean disconnect.
11. Multi-client WebSocket consistency: Multiple clients receive identical valid telemetry frames.
"""

import unittest
from fastapi.testclient import TestClient

from backend.app.main import app, orchestrator
from backend.app.schemas.telemetry import TelemetryFrameSchema


class TestFastApiRestEndpoints(unittest.TestCase):
    """Unit tests for the FastAPI REST interface."""

    def setUp(self) -> None:
        self.client = TestClient(app)
        # Reset orchestrator before each test for clean deterministic state
        orchestrator.reset()

    def test_health_endpoint(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["swarmTotal"], 12)
        self.assertIn("activeLinks", data)
        self.assertFalse(data["isPaused"])

    def test_get_current_state_schema_validation(self) -> None:
        response = self.client.get("/api/state")
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # Validate against strict Pydantic TelemetryFrameSchema
        frame = TelemetryFrameSchema.model_validate(data)
        self.assertEqual(len(frame.satellites), 12)
        self.assertEqual(frame.swarmSummary.total, 12)
        self.assertEqual(frame.swarmSummary.coordinatorId, "SAT-07")
        self.assertIn("links", data)
        self.assertIn("network", data)

    def test_manual_simulation_step(self) -> None:
        initial_elapsed = orchestrator.clock.elapsed_seconds
        response = self.client.post("/api/simulation/step", json={"dt": 5.0})
        self.assertEqual(response.status_code, 200)
        data = response.json()

        self.assertAlmostEqual(data["clock"]["elapsedSec"], initial_elapsed + 5.0)

    def test_pause_and_resume_endpoints(self) -> None:
        # Pause
        res_pause = self.client.post("/api/simulation/pause")
        self.assertEqual(res_pause.status_code, 200)
        self.assertTrue(res_pause.json()["data"]["isPaused"])
        self.assertTrue(orchestrator.clock.is_paused)

        # Resume
        res_resume = self.client.post("/api/simulation/resume")
        self.assertEqual(res_resume.status_code, 200)
        self.assertFalse(res_resume.json()["data"]["isPaused"])
        self.assertFalse(orchestrator.clock.is_paused)

    def test_warp_factor_endpoint_valid_and_invalid(self) -> None:
        # Valid warp factor
        res_warp = self.client.post("/api/simulation/warp", json={"warpFactor": 10.0})
        self.assertEqual(res_warp.status_code, 200)
        self.assertEqual(orchestrator.clock.warp_factor, 10.0)

        # Invalid negative warp factor
        res_invalid = self.client.post("/api/simulation/warp", json={"warpFactor": -5.0})
        self.assertEqual(res_invalid.status_code, 422)  # Pydantic ge=0.0 validation error

    def test_fault_injection_valid(self) -> None:
        payload = {
            "targetSatelliteId": "SAT-04",
            "failureType": "Communication Failure",
            "severity": "CRITICAL",
            "description": "Transponder antenna short-circuit",
        }
        response = self.client.post("/api/simulation/fault", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["satelliteId"], "SAT-04")
        self.assertEqual(data["severity"], "critical")
        self.assertEqual(data["message"], "Transponder antenna short-circuit")

        # Verify satellite state changed in state API
        sat_04 = orchestrator.get_satellite("SAT-04")
        self.assertIsNotNone(sat_04)
        self.assertEqual(sat_04.state.value, "FAILED")

    def test_fault_injection_unknown_satellite_id_returns_404(self) -> None:
        payload = {
            "targetSatelliteId": "SAT-99_INVALID",
            "failureType": "Propulsion Failure",
            "severity": "CRITICAL",
        }
        response = self.client.post("/api/simulation/fault", json=payload)
        self.assertEqual(response.status_code, 404)
        self.assertIn("not found", response.json()["detail"].lower())

    def test_get_events_history(self) -> None:
        self.client.post("/api/simulation/fault", json={
            "targetSatelliteId": "SAT-02",
            "failureType": "Propulsion Failure",
            "severity": "MODERATE",
        })
        response = self.client.get("/api/events")
        self.assertEqual(response.status_code, 200)
        events = response.json()
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0]["satelliteId"], "SAT-02")

    def test_reset_simulation_endpoint(self) -> None:
        # Inject fault then reset
        self.client.post("/api/simulation/fault", json={
            "targetSatelliteId": "SAT-04",
            "failureType": "Node Loss",
            "severity": "CRITICAL",
        })
        self.assertEqual(orchestrator.get_satellite("SAT-04").state.value, "FAILED")

        res_reset = self.client.post("/api/simulation/reset", json={"initialElapsedSec": 0.0})
        self.assertEqual(res_reset.status_code, 200)
        self.assertEqual(orchestrator.get_satellite("SAT-04").state.value, "NOMINAL")
        self.assertEqual(len(orchestrator.events), 0)


class TestWebSocketTelemetryStream(unittest.TestCase):
    """Unit tests for the live WebSocket streaming endpoint."""

    def setUp(self) -> None:
        self.client = TestClient(app)
        orchestrator.reset()

    def test_websocket_connect_and_receive_valid_frame(self) -> None:
        with self.client.websocket_connect("/ws/telemetry") as websocket:
            # Receive initial immediate snapshot
            data = websocket.receive_json()
            self.assertIn("clock", data)
            self.assertIn("satellites", data)
            self.assertIn("links", data)
            self.assertIn("network", data)
            self.assertEqual(len(data["satellites"]), 12)

            # Strict Pydantic model validation of streamed packet
            frame = TelemetryFrameSchema.model_validate(data)
            self.assertEqual(frame.swarmSummary.total, 12)

    def test_multiple_websocket_clients_receive_identical_state(self) -> None:
        with self.client.websocket_connect("/ws/telemetry") as ws1:
            with self.client.websocket_connect("/ws/telemetry") as ws2:
                data1 = ws1.receive_json()
                data2 = ws2.receive_json()

                # Both clients receive identical satellite counts and clock time
                self.assertEqual(data1["clock"]["elapsedSec"], data2["clock"]["elapsedSec"])
                self.assertEqual(len(data1["satellites"]), len(data2["satellites"]))
                self.assertEqual(data1["links"], data2["links"])


if __name__ == "__main__":
    unittest.main()

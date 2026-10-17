/**
 * ASTRANET — Live Swarm Telemetry WebSocket & Control Hook
 *
 * Provides a resilient, high-frequency connection to the FastAPI simulation backend
 * (ws://localhost:8000/ws/telemetry), streaming validated digital-twin kinematics,
 * dynamic RF network topology, physical fault events, and master simulation clock state.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  SatelliteTelemetry,
  MissionEvent,
  NetworkSummary,
  SwarmClock,
  SwarmSummary,
  TelemetryFrame,
  FailureType,
  FailureSeverity,
  INITIAL_SATELLITES,
  INITIAL_EVENTS,
} from "../data/mockMissionControl";

export interface UseSwarmTelemetryReturn {
  satellites: SatelliteTelemetry[];
  events: MissionEvent[];
  links: Array<[string, string]>;
  networkMetrics: NetworkSummary | null;
  clock: SwarmClock | null;
  swarmSummary: SwarmSummary | null;
  isConnected: boolean;
  isReconnecting: boolean;
  isPaused: boolean;
  error: string | null;
  apiBaseUrl: string;
  injectFault: (
    targetSatelliteId: string,
    failureType: FailureType,
    severity?: FailureSeverity,
    description?: string
  ) => Promise<{ ok: boolean; success: boolean; error?: string }>;
  pauseSimulation: () => Promise<boolean>;
  resumeSimulation: () => Promise<boolean>;
  resetSimulation: () => Promise<boolean>;
  stepSimulation: (dt?: number) => Promise<boolean>;
  setWarpFactor: (warpFactor: number) => Promise<boolean>;
}

export function useSwarmTelemetry(): UseSwarmTelemetryReturn {
  // Resolve backend HTTP and WebSocket URLs
  const apiBaseUrl =
    (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";
  const wsUrl =
    apiBaseUrl.replace(/^http(s?):/, "ws$1:") + "/ws/telemetry";

  const [satellites, setSatellites] = useState<SatelliteTelemetry[]>(INITIAL_SATELLITES);
  const [events, setEvents] = useState<MissionEvent[]>(INITIAL_EVENTS);
  const [links, setLinks] = useState<Array<[string, string]>>([]);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkSummary | null>(null);
  const [clock, setClock] = useState<SwarmClock | null>(null);
  const [swarmSummary, setSwarmSummary] = useState<SwarmSummary | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const connectWebSocket = useCallback(() => {
    if (!isMountedRef.current) return;

    // Clean up existing socket if any
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        if (!isMountedRef.current) return;
        setIsConnected(true);
        setIsReconnecting(false);
        setError(null);
        retryCountRef.current = 0;
      };

      socket.onmessage = (event: MessageEvent) => {
        if (!isMountedRef.current) return;
        try {
          const frame: TelemetryFrame = JSON.parse(event.data);

          // Validate frame integrity
          if (frame && Array.isArray(frame.satellites) && frame.clock) {
            setSatellites(frame.satellites);
            if (Array.isArray(frame.events)) {
              setEvents(frame.events);
            }
            if (Array.isArray(frame.links)) {
              setLinks(frame.links);
            }
            if (frame.network) {
              setNetworkMetrics(frame.network);
            }
            if (frame.swarmSummary) {
              setSwarmSummary(frame.swarmSummary);
            }
            setClock(frame.clock);
            setIsPaused(Boolean(frame.clock.isPaused));
          }
        } catch (err) {
          console.warn("ASTRANET: Failed to parse incoming telemetry frame", err);
        }
      };

      socket.onerror = () => {
        if (!isMountedRef.current) return;
        setError("WebSocket connection failed");
      };

      socket.onclose = () => {
        if (!isMountedRef.current) return;
        setIsConnected(false);
        socketRef.current = null;

        // Bounded exponential backoff: 1s, 1.5s, 2.25s, ... capped at 10s
        const backoffMs = Math.min(
          10000,
          1000 * Math.pow(1.5, retryCountRef.current)
        );
        retryCountRef.current += 1;
        setIsReconnecting(true);

        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectWebSocket();
        }, backoffMs);
      };
    } catch (err: any) {
      if (isMountedRef.current) {
        setIsConnected(false);
        setError(err?.message || "Failed to initiate WebSocket");
      }
    }
  }, [wsUrl]);

  useEffect(() => {
    isMountedRef.current = true;
    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // REST API Actions
  const injectFault = useCallback(
    async (
      targetSatelliteId: string,
      failureType: FailureType,
      severity: FailureSeverity = "CRITICAL",
      description?: string
    ) => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/simulation/fault`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetSatelliteId,
            failureType,
            severity,
            description,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            ok: false,
            success: false,
            error: errorData.detail || `HTTP ${response.status}: Failed to inject fault`,
          };
        }

        return { ok: true, success: true };
      } catch (err: any) {
        return {
          ok: false,
          success: false,
          error: err.message || "Network request failed",
        };
      }
    },
    [apiBaseUrl]
  );

  const pauseSimulation = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/simulation/pause`, {
        method: "POST",
      });
      if (response.ok) {
        setIsPaused(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [apiBaseUrl]);

  const resumeSimulation = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/simulation/resume`, {
        method: "POST",
      });
      if (response.ok) {
        setIsPaused(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [apiBaseUrl]);

  const resetSimulation = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/simulation/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialElapsedSec: 0.0 }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [apiBaseUrl]);

  const stepSimulation = useCallback(
    async (dt?: number) => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/simulation/step`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dt }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    [apiBaseUrl]
  );

  const setWarpFactor = useCallback(
    async (warpFactor: number) => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/simulation/warp`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ warpFactor }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    [apiBaseUrl]
  );

  return {
    satellites,
    events,
    links,
    networkMetrics,
    clock,
    swarmSummary,
    isConnected,
    isReconnecting,
    isPaused,
    error,
    apiBaseUrl,
    injectFault,
    pauseSimulation,
    resumeSimulation,
    resetSimulation,
    stepSimulation,
    setWarpFactor,
  };
}

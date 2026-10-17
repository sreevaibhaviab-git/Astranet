// ============================================================================
// ASTRANET MISSION CONTROL — MOCK DATA MODULE
// Separated mock data and state engine for CubeSat swarm telemetry
// ============================================================================

export type SatelliteState =
  | "NOMINAL"
  | "WARNING"
  | "SUSPECTED"
  | "DEGRADED"
  | "FAILED"
  | "ISOLATED"
  | "RECOVERING";

export type SubsystemStatus = "NOMINAL" | "WARNING" | "DEGRADED" | "FAILED";

export interface SatelliteSubsystems {
  communications: SubsystemStatus;
  navigation: SubsystemStatus;
  propulsion: SubsystemStatus;
  power: SubsystemStatus;
  payload: SubsystemStatus;
  attitudeControl: SubsystemStatus;
  compute: SubsystemStatus;
}

export interface SatelliteCapabilities {
  sensing: boolean;
  relay: boolean;
  navigation: boolean;
  compute: boolean;
  storage: boolean;
  maneuvering: boolean;
}

export interface SatelliteNetwork {
  neighbors: number;
  latencyMs: number;
  packetLoss: number;
  linkQuality: number;
  localEpoch: number;
}

export interface PositionVector {
  x: number; // km (ECI)
  y: number; // km (ECI)
  z: number; // km (ECI)
  lat: number; // Geodetic Latitude in degrees (-90 to +90)
  lon: number; // Geographic Longitude in degrees (-180 to +180)
  altKm: number; // Altitude in kilometers above mean Earth (550 km)
}

export interface VelocityVector {
  vx: number; // km/s (ECI)
  vy: number; // km/s (ECI)
  vz: number; // km/s (ECI)
  speedKmS: number; // Orbital speed in km/s (~7.59 km/s)
}

export interface NetworkSummary {
  activeLinks: number;
  connected: boolean;
  partitionCount: number;
  averageLatencyMs: number;
  maxRangeKm: number;
}

export interface SwarmClock {
  epochSec: number;
  elapsedSec: number;
  timeString: string;
  utcString: string;
  warpFactor: number;
  isPaused: boolean;
  ticks: number;
}

export interface SwarmSummary {
  total: number;
  nominal: number;
  degraded: number;
  failed: number;
  coordinatorId: string;
  missionCode: string;
  missionState: string;
}

export interface TelemetryFrame {
  clock: SwarmClock;
  satellites: SatelliteTelemetry[];
  links: Array<[string, string]>;
  network: NetworkSummary;
  events: MissionEvent[];
  swarmSummary: SwarmSummary;
}

export interface SatelliteTelemetry {
  id: string; // e.g. "SAT-07"
  name: string;
  plane: "PLANE A" | "PLANE B" | "PLANE C";
  planeIndex: number; // 0, 1, 2
  slot: "SLOT 01" | "SLOT 02" | "SLOT 03" | "SLOT 04";
  slotIndex: number; // 0, 1, 2, 3
  state: SatelliteState;
  role: "COORDINATOR" | "RELAY" | "OBSERVER" | "ISOLATED";
  // Orbital characteristics
  altitudeKm: number;
  inclinationDeg: number;
  phaseDeg: number; // initial orbital phase angle (0-360)
  orbitPeriodSec: number;
  // Live digital twin kinematics from simulation backend
  position?: PositionVector;
  velocity?: VelocityVector;
  // Resource metrics
  battery: number; // percentage (0-100)
  propellant: number; // percentage (0-100)
  compute: number; // percentage (0-100)
  storage: number; // percentage (0-100)
  trust: number; // 0.0 - 1.0
  // Subsystems & Capabilities
  subsystems: SatelliteSubsystems;
  capabilities: SatelliteCapabilities;
  network: SatelliteNetwork;
  // Recovery
  autonomyStatus: string;
  missionState: string;
  lastAnomaly?: string;
}

export interface MissionEvent {
  id: string;
  timestamp: string; // HH:MM:SS
  type: "TELEMETRY" | "SYNC" | "TOPOLOGY" | "MISSION" | "FAULT" | "RECOVERY";
  category: "ALL" | "FAULTS" | "RECOVERY" | "NETWORK";
  satelliteId?: string;
  severity: "nominal" | "info" | "warning" | "critical";
  message: string;
}

export type FailureType =
  | "Node Loss"
  | "Communication Failure"
  | "Propulsion Failure"
  | "Navigation Failure"
  | "Power Degradation"
  | "Network Partition"
  | "Stale State"
  | "Corrupted Telemetry"
  | "Byzantine Behavior"
  | "Multiple Failure";

export type FailureSeverity = "MINOR" | "MODERATE" | "CRITICAL";

// Initial 12 CubeSats in 3 orbital planes (4 per plane)
export const INITIAL_SATELLITES: SatelliteTelemetry[] = [
  // PLANE A: SAT-01 to SAT-04 (inclination 48 deg)
  {
    id: "SAT-01",
    name: "SAT-01",
    plane: "PLANE A",
    planeIndex: 0,
    slot: "SLOT 01",
    slotIndex: 0,
    state: "NOMINAL",
    role: "OBSERVER",
    altitudeKm: 550,
    inclinationDeg: 48,
    phaseDeg: 0,
    orbitPeriodSec: 95.5,
    battery: 89,
    propellant: 78,
    compute: 28,
    storage: 36,
    trust: 0.99,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 16,
      packetLoss: 0.2,
      linkQuality: 98,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
  {
    id: "SAT-02",
    name: "SAT-02",
    plane: "PLANE A",
    planeIndex: 0,
    slot: "SLOT 02",
    slotIndex: 1,
    state: "NOMINAL",
    role: "OBSERVER",
    altitudeKm: 550,
    inclinationDeg: 48,
    phaseDeg: 90,
    orbitPeriodSec: 95.5,
    battery: 84,
    propellant: 76,
    compute: 31,
    storage: 42,
    trust: 0.98,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 17,
      packetLoss: 0.3,
      linkQuality: 97,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
  {
    id: "SAT-03",
    name: "SAT-03",
    plane: "PLANE A",
    planeIndex: 0,
    slot: "SLOT 03",
    slotIndex: 2,
    state: "NOMINAL",
    role: "RELAY",
    altitudeKm: 550,
    inclinationDeg: 48,
    phaseDeg: 180,
    orbitPeriodSec: 95.5,
    battery: 91,
    propellant: 81,
    compute: 35,
    storage: 39,
    trust: 0.99,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 15,
      packetLoss: 0.3,
      linkQuality: 98,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
  {
    id: "SAT-04",
    name: "SAT-04",
    plane: "PLANE A",
    planeIndex: 0,
    slot: "SLOT 04",
    slotIndex: 3,
    state: "NOMINAL",
    role: "OBSERVER",
    altitudeKm: 550,
    inclinationDeg: 48,
    phaseDeg: 270,
    orbitPeriodSec: 95.5,
    battery: 87,
    propellant: 72,
    compute: 29,
    storage: 44,
    trust: 0.97,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 19,
      packetLoss: 0.4,
      linkQuality: 96,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },

  // PLANE B: SAT-05 to SAT-08 (inclination 53 deg) - SAT-07 is COORDINATOR
  {
    id: "SAT-05",
    name: "SAT-05",
    plane: "PLANE B",
    planeIndex: 1,
    slot: "SLOT 01",
    slotIndex: 0,
    state: "NOMINAL",
    role: "RELAY",
    altitudeKm: 550,
    inclinationDeg: 53,
    phaseDeg: 30,
    orbitPeriodSec: 95.5,
    battery: 85,
    propellant: 79,
    compute: 33,
    storage: 38,
    trust: 0.99,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 17,
      packetLoss: 0.3,
      linkQuality: 97,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
  {
    id: "SAT-06",
    name: "SAT-06",
    plane: "PLANE B",
    planeIndex: 1,
    slot: "SLOT 02",
    slotIndex: 1,
    state: "NOMINAL",
    role: "OBSERVER",
    altitudeKm: 550,
    inclinationDeg: 53,
    phaseDeg: 120,
    orbitPeriodSec: 95.5,
    battery: 88,
    propellant: 75,
    compute: 30,
    storage: 40,
    trust: 0.98,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 18,
      packetLoss: 0.4,
      linkQuality: 96,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
  {
    id: "SAT-07",
    name: "SAT-07",
    plane: "PLANE B",
    planeIndex: 1,
    slot: "SLOT 03",
    slotIndex: 2,
    state: "NOMINAL",
    role: "COORDINATOR",
    altitudeKm: 550,
    inclinationDeg: 53,
    phaseDeg: 210,
    orbitPeriodSec: 95.5,
    battery: 86,
    propellant: 74,
    compute: 34,
    storage: 41,
    trust: 0.98,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 18,
      packetLoss: 0.4,
      linkQuality: 96,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
  {
    id: "SAT-08",
    name: "SAT-08",
    plane: "PLANE B",
    planeIndex: 1,
    slot: "SLOT 04",
    slotIndex: 3,
    state: "NOMINAL",
    role: "OBSERVER",
    altitudeKm: 550,
    inclinationDeg: 53,
    phaseDeg: 300,
    orbitPeriodSec: 95.5,
    battery: 90,
    propellant: 77,
    compute: 27,
    storage: 37,
    trust: 0.99,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 16,
      packetLoss: 0.2,
      linkQuality: 98,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },

  // PLANE C: SAT-09 to SAT-12 (inclination 60 deg)
  {
    id: "SAT-09",
    name: "SAT-09",
    plane: "PLANE C",
    planeIndex: 2,
    slot: "SLOT 01",
    slotIndex: 0,
    state: "NOMINAL",
    role: "OBSERVER",
    altitudeKm: 550,
    inclinationDeg: 60,
    phaseDeg: 60,
    orbitPeriodSec: 95.5,
    battery: 89,
    propellant: 80,
    compute: 29,
    storage: 35,
    trust: 0.99,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 17,
      packetLoss: 0.3,
      linkQuality: 97,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
  {
    id: "SAT-10",
    name: "SAT-10",
    plane: "PLANE C",
    planeIndex: 2,
    slot: "SLOT 02",
    slotIndex: 1,
    state: "NOMINAL",
    role: "RELAY",
    altitudeKm: 550,
    inclinationDeg: 60,
    phaseDeg: 150,
    orbitPeriodSec: 95.5,
    battery: 86,
    propellant: 73,
    compute: 32,
    storage: 43,
    trust: 0.98,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 19,
      packetLoss: 0.4,
      linkQuality: 95,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
  {
    id: "SAT-11",
    name: "SAT-11",
    plane: "PLANE C",
    planeIndex: 2,
    slot: "SLOT 03",
    slotIndex: 2,
    state: "NOMINAL",
    role: "OBSERVER",
    altitudeKm: 550,
    inclinationDeg: 60,
    phaseDeg: 240,
    orbitPeriodSec: 95.5,
    battery: 92,
    propellant: 82,
    compute: 26,
    storage: 36,
    trust: 0.99,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 16,
      packetLoss: 0.2,
      linkQuality: 98,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
  {
    id: "SAT-12",
    name: "SAT-12",
    plane: "PLANE C",
    planeIndex: 2,
    slot: "SLOT 04",
    slotIndex: 3,
    state: "NOMINAL",
    role: "OBSERVER",
    altitudeKm: 550,
    inclinationDeg: 60,
    phaseDeg: 330,
    orbitPeriodSec: 95.5,
    battery: 88,
    propellant: 78,
    compute: 30,
    storage: 40,
    trust: 0.98,
    subsystems: {
      communications: "NOMINAL",
      navigation: "NOMINAL",
      propulsion: "NOMINAL",
      power: "NOMINAL",
      payload: "NOMINAL",
      attitudeControl: "NOMINAL",
      compute: "NOMINAL",
    },
    capabilities: {
      sensing: true,
      relay: true,
      navigation: true,
      compute: true,
      storage: true,
      maneuvering: true,
    },
    network: {
      neighbors: 4,
      latencyMs: 18,
      packetLoss: 0.3,
      linkQuality: 97,
      localEpoch: 1842,
    },
    autonomyStatus: "No active recovery actions",
    missionState: "NOMINAL",
  },
];

// Initial quiet operational event stream
export const INITIAL_EVENTS: MissionEvent[] = [
  {
    id: "ev-1",
    timestamp: "14:28:31",
    type: "TELEMETRY",
    category: "ALL",
    satelliteId: "SAT-04",
    severity: "nominal",
    message: "SAT-04 telemetry nominal",
  },
  {
    id: "ev-2",
    timestamp: "14:28:33",
    type: "SYNC",
    category: "ALL",
    satelliteId: "SAT-07",
    severity: "nominal",
    message: "SAT-07 local state synchronized",
  },
  {
    id: "ev-3",
    timestamp: "14:28:36",
    type: "TOPOLOGY",
    category: "NETWORK",
    severity: "nominal",
    message: "Plane B link topology updated",
  },
  {
    id: "ev-4",
    timestamp: "14:28:39",
    type: "MISSION",
    category: "ALL",
    severity: "nominal",
    message: "Mission objective stable",
  },
  {
    id: "ev-5",
    timestamp: "14:28:44",
    type: "SYNC",
    category: "ALL",
    severity: "nominal",
    message: "Byzantine quorum epoch 1842 ratified",
  },
  {
    id: "ev-6",
    timestamp: "14:28:49",
    type: "TELEMETRY",
    category: "ALL",
    satelliteId: "SAT-11",
    severity: "nominal",
    message: "SAT-11 ephemeris vector converged",
  },
];

// Available failure injection options
export const FAILURE_TYPES: FailureType[] = [
  "Node Loss",
  "Communication Failure",
  "Propulsion Failure",
  "Navigation Failure",
  "Power Degradation",
  "Network Partition",
  "Stale State",
  "Corrupted Telemetry",
  "Byzantine Behavior",
  "Multiple Failure",
];

// State machine helper for failure injection
export function applyFailureToSwarm(
  satellites: SatelliteTelemetry[],
  targetId: string,
  failureType: FailureType,
  severity: FailureSeverity
): {
  updatedSatellites: SatelliteTelemetry[];
  newEvent: MissionEvent;
} {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const targetState: SatelliteState =
    severity === "CRITICAL"
      ? "FAILED"
      : severity === "MODERATE"
      ? "DEGRADED"
      : "WARNING";

  const updatedSatellites = satellites.map((sat) => {
    if (sat.id !== targetId) return sat;

    const updatedSubsystems: SatelliteSubsystems = { ...sat.subsystems };
    const updatedCaps: SatelliteCapabilities = { ...sat.capabilities };

    if (failureType === "Propulsion Failure") {
      updatedSubsystems.propulsion = severity === "CRITICAL" ? "FAILED" : "DEGRADED";
      updatedCaps.maneuvering = false;
    } else if (failureType === "Communication Failure") {
      updatedSubsystems.communications = severity === "CRITICAL" ? "FAILED" : "DEGRADED";
      updatedCaps.relay = false;
    } else if (failureType === "Power Degradation") {
      updatedSubsystems.power = severity === "CRITICAL" ? "FAILED" : "WARNING";
      sat.battery = Math.max(12, sat.battery - 45);
    } else if (failureType === "Navigation Failure") {
      updatedSubsystems.navigation = severity === "CRITICAL" ? "FAILED" : "DEGRADED";
      updatedCaps.navigation = false;
    } else if (failureType === "Node Loss") {
      updatedSubsystems.communications = "FAILED";
      updatedSubsystems.compute = "FAILED";
      updatedCaps.relay = false;
      updatedCaps.sensing = false;
    } else {
      updatedSubsystems.attitudeControl = "WARNING";
    }

    return {
      ...sat,
      state: targetState,
      subsystems: updatedSubsystems,
      capabilities: updatedCaps,
      autonomyStatus: `Autonomous fault isolation triggered: ${failureType}`,
      missionState: targetState === "FAILED" ? "DEGRADED" : "INVESTIGATING",
      lastAnomaly: `${failureType} (${severity})`,
      trust: severity === "CRITICAL" ? 0.32 : 0.74,
      network: {
        ...sat.network,
        packetLoss: severity === "CRITICAL" ? 28.5 : 8.2,
        linkQuality: severity === "CRITICAL" ? 42 : 71,
      },
    };
  });

  const newEvent: MissionEvent = {
    id: `ev-fault-${Date.now()}`,
    timestamp: timeStr,
    type: "FAULT",
    category: "FAULTS",
    satelliteId: targetId,
    severity: severity === "CRITICAL" ? "critical" : "warning",
    message: `${targetId} ${failureType.toLowerCase()} flagged by peer watchdog (${severity})`,
  };

  return { updatedSatellites, newEvent };
}

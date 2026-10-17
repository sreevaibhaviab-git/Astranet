import { useState, useEffect } from "react";
import {
  MissionEvent,
  INITIAL_SATELLITES,
  applyFailureToSwarm,
  FailureType,
  FailureSeverity,
} from "../../data/mockMissionControl";
import { useSwarmTelemetry } from "../../hooks/useSwarmTelemetry";
import CesiumGlobe from "./CesiumGlobe";
import OperationsLeftPanel from "./OperationsLeftPanel";
import SelectedSatelliteRightPanel from "./SelectedSatelliteRightPanel";
import MetricsBottomBar from "./MetricsBottomBar";
import FaultInjectionModal from "./FaultInjectionModal";
import { Search, ArrowLeft } from "lucide-react";

interface MissionControlDashboardProps {
  onExit: () => void;
}

export default function MissionControlDashboard({
  onExit,
}: MissionControlDashboardProps) {
  // Live Backend Telemetry Hook
  const {
    satellites,
    events,
    networkMetrics,
    clock,
    swarmSummary,
    links,
    connectionStatus,
    isConnected,
    isPaused,
    error: telemetryError,
    injectFault: backendInjectFault,
    resetSimulation: backendResetSimulation,
    pauseSimulation,
    resumeSimulation,
  } = useSwarmTelemetry();

  // Selection & Navigation State
  const [selectedSatelliteId, setSelectedSatelliteId] = useState<string>("SAT-07");
  const [activeNavTab, setActiveNavTab] = useState<string>("Live Globe");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFaultModalOpen, setIsFaultModalOpen] = useState<boolean>(false);

  // Fallback Simulation Clock (T+ 00:14:32 counter) for standalone mode
  const [simSeconds, setSimSeconds] = useState<number>(872);
  const [utcTime, setUtcTime] = useState<string>("");

  useEffect(() => {
    const timer = setInterval(() => {
      setSimSeconds((prev) => prev + 1);

      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, "0");
      const m = String(now.getUTCMinutes()).padStart(2, "0");
      const s = String(now.getUTCSeconds()).padStart(2, "0");
      setUtcTime(`${h}:${m}:${s} UTC`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatMissionTime = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  };

  const selectedSatellite =
    satellites.find((s) => s.id === selectedSatelliteId) ||
    satellites[0] ||
    INITIAL_SATELLITES[0];

  const coordinatorId = swarmSummary?.coordinatorId || "SAT-07";

  const isAnyFaultActive =
    satellites.some((s) => s.state !== "NOMINAL") ||
    (swarmSummary ? swarmSummary.failed > 0 || swarmSummary.degraded > 0 : false);

  const handleInjectFault = async (
    targetId: string,
    failureType: FailureType,
    severity: FailureSeverity
  ) => {
    if (isConnected) {
      const res = await backendInjectFault(targetId, failureType, severity);
      if (!res.ok) {
        throw new Error(res.error || "Fault injection rejected by simulation engine.");
      }
      setSelectedSatelliteId(targetId);
      return;
    }

    // Fallback standalone local mock mode
    const { updatedSatellites } = applyFailureToSwarm(
      satellites,
      targetId,
      failureType,
      severity
    );
    setSelectedSatelliteId(targetId);
  };

  const handleResetSwarm = async () => {
    if (isConnected) {
      await backendResetSimulation();
      setSelectedSatelliteId("SAT-07");
      return;
    }

    setSelectedSatelliteId("SAT-07");
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const match = satellites.find((s) =>
        s.id.toLowerCase().includes(searchQuery.trim().toLowerCase())
      );
      if (match) {
        setSelectedSatelliteId(match.id);
        setSearchQuery("");
      }
    }
  };

  const currentMissionElapsedSec = clock ? clock.elapsedSec : simSeconds;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#05080D] text-[#F3F6F8] font-sans select-none overflow-hidden antialiased">
      {/* =========================================================================
          SLIM ELEGANT TOP BAR
          ========================================================================= */}
      <header className="h-13 shrink-0 bg-[#080D15]/95 border-b border-white/6 px-6 flex items-center justify-between z-30">
        {/* Left: ASTRANET MC + Mission Control subtitle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            title="Return to overview"
            className="p-1 rounded-md text-[#7F8C9A] hover:text-white transition-colors cursor-pointer mr-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm tracking-tight text-white">
              ASTRANET MC
            </span>
            <span className="text-xs text-[#7F8C9A] font-normal">
              Mission Control
            </span>
          </div>
        </div>

        {/* Center: Clean Modern Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-6 text-xs">
          {[
            "Live Globe",
            "Swarm",
            "Telemetry",
            "Events",
            "Simulation",
          ].map((tab) => {
            const isActive = activeNavTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveNavTab(tab)}
                className={`py-1 transition-colors cursor-pointer text-xs ${
                  isActive
                    ? "text-white font-medium border-b border-white"
                    : "text-[#7F8C9A] hover:text-[#F3F6F8]"
                }`}
              >
                {tab}
              </button>
            );
          })}
        </nav>

        {/* Right: Search, Live Sim State & Time */}
        <div className="flex items-center gap-4 text-xs">
          {/* Minimal Search Input */}
          <div className="relative hidden sm:block">
            <Search className="w-3.5 h-3.5 text-[#7F8C9A] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search satellites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-40 pl-8 pr-3 py-1 rounded-md bg-white/[0.04] border border-white/8 text-xs text-white placeholder-[#7F8C9A]/60 focus:outline-none focus:border-white/20 transition-colors"
            />
          </div>

          {/* Pause / Resume simulation control */}
          {isConnected && (
            <button
              onClick={() => (isPaused ? resumeSimulation() : pauseSimulation())}
              title={isPaused ? "Resume simulation execution" : "Pause simulation execution"}
              className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs text-[#AAB7C4] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
            >
              {isPaused ? "▶ Resume" : "⏸ Pause"}
            </button>
          )}

          {/* LIVE SIM / RECONNECTING / STANDALONE MOCK badge */}
          {connectionStatus === "connected" ? (
            <div
              className="flex items-center gap-1.5 text-xs text-[#10B981] font-medium"
              title="Connected to FastAPI WebSocket /ws/telemetry"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span>LIVE SIM</span>
              {isPaused && (
                <span className="text-[10px] text-[#F59E0B] font-mono px-1 py-0.2 rounded bg-[#F59E0B]/10 border border-[#F59E0B]/20">
                  PAUSED
                </span>
              )}
            </div>
          ) : connectionStatus === "reconnecting" ? (
            <div
              className="flex items-center gap-1.5 text-xs text-[#F59E0B] font-medium"
              title="Reconnecting to backend with exponential backoff..."
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B] animate-ping" />
              <span>RECONNECTING</span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 text-xs text-[#EF4444] font-medium"
              title={telemetryError || "Backend disconnected; running with standalone fallback fixtures"}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
              <span>STANDALONE MOCK</span>
            </div>
          )}

          {/* UTC Clock */}
          <div className="text-xs text-[#7F8C9A] tabular-nums font-normal">
            {utcTime || "18:32:44 UTC"}
          </div>
        </div>
      </header>

      {/* =========================================================================
          MAIN WORKSPACE LAYOUT
          SLIM LEFT EVENT RAIL | VAST OPEN CENTER GLOBE | CLEAN RIGHT INSPECTOR
          ========================================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* SLIM LEFT OPERATIONS RAIL (256px) */}
        <OperationsLeftPanel events={events} satellites={satellites} />

        {/* VAST OPEN CENTER GLOBE STAGE (UNDISPUTED HERO) */}
        <main className="flex-1 relative h-full flex flex-col bg-[#05080D] overflow-hidden">
          <CesiumGlobe
            satellites={satellites}
            selectedSatelliteId={selectedSatelliteId}
            onSelectSatellite={setSelectedSatelliteId}
            missionTime={formatMissionTime(currentMissionElapsedSec)}
            coordinatorId={coordinatorId}
            activeLinks={links}
          />
        </main>

        {/* CLEAN RIGHT SELECTED SATELLITE PANEL (320px) */}
        <SelectedSatelliteRightPanel
          satellite={selectedSatellite}
          onOpenFaultModal={() => setIsFaultModalOpen(false || true)}
          onResetSwarm={handleResetSwarm}
          isAnyFaultActive={isAnyFaultActive}
        />
      </div>

      {/* =========================================================================
          RESTRAINED BOTTOM SUMMARY STRIP
          ========================================================================= */}
      <footer className="shrink-0 z-20">
        <MetricsBottomBar
          satellites={satellites}
          networkSummary={networkMetrics}
          swarmSummary={swarmSummary}
        />
      </footer>

      {/* =========================================================================
          FAULT INJECTION CONTROL MODAL
          ========================================================================= */}
      <FaultInjectionModal
        isOpen={isFaultModalOpen}
        onClose={() => setIsFaultModalOpen(false)}
        satellites={satellites}
        onInject={handleInjectFault}
      />
    </div>
  );
}

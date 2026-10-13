import { useState, useEffect } from "react";
import {
  SatelliteTelemetry,
  MissionEvent,
  INITIAL_SATELLITES,
  INITIAL_EVENTS,
  applyFailureToSwarm,
  FailureType,
  FailureSeverity,
} from "../../data/mockMissionControl";
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
  // Swarm State
  const [satellites, setSatellites] =
    useState<SatelliteTelemetry[]>(INITIAL_SATELLITES);
  const [selectedSatelliteId, setSelectedSatelliteId] =
    useState<string>("SAT-07"); // Default selected: SAT-07
  const [events, setEvents] = useState<MissionEvent[]>(INITIAL_EVENTS);
  const [activeNavTab, setActiveNavTab] = useState<string>("Live Globe");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isFaultModalOpen, setIsFaultModalOpen] = useState<boolean>(false);

  // Simulation Clock (T+ 00:14:32 counter)
  const [simSeconds, setSimSeconds] = useState<number>(872); // 14m 32s
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
    const secs = totalSec % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  };

  const selectedSatellite =
    satellites.find((s) => s.id === selectedSatelliteId) || satellites[6];

  const isAnyFaultActive = satellites.some((s) => s.state !== "NOMINAL");

  const handleInjectFault = (
    targetId: string,
    failureType: FailureType,
    severity: FailureSeverity
  ) => {
    const { updatedSatellites, newEvent } = applyFailureToSwarm(
      satellites,
      targetId,
      failureType,
      severity
    );

    setSatellites(updatedSatellites);
    setEvents((prev) => [newEvent, ...prev]);
    setSelectedSatelliteId(targetId);
  };

  const handleResetSwarm = () => {
    setSatellites(INITIAL_SATELLITES);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(
      now.getMinutes()
    ).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const resetEvent: MissionEvent = {
      id: `ev-reset-${Date.now()}`,
      timestamp: timeStr,
      type: "RECOVERY",
      category: "RECOVERY",
      severity: "nominal",
      message: "All 12 CubeSat nodes reset to nominal state",
    };
    setEvents((prev) => [resetEvent, ...prev]);
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

          {/* LIVE SIM badge */}
          <div className="flex items-center gap-1.5 text-xs text-[#10B981] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span>LIVE SIM</span>
          </div>

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
            missionTime={formatMissionTime(simSeconds)}
            coordinatorId="SAT-07"
          />
        </main>

        {/* CLEAN RIGHT SELECTED SATELLITE PANEL (320px) */}
        <SelectedSatelliteRightPanel
          satellite={selectedSatellite}
          onOpenFaultModal={() => setIsFaultModalOpen(true)}
          onResetSwarm={handleResetSwarm}
          isAnyFaultActive={isAnyFaultActive}
        />
      </div>

      {/* =========================================================================
          RESTRAINED BOTTOM SUMMARY STRIP
          ========================================================================= */}
      <footer className="shrink-0 z-20">
        <MetricsBottomBar satellites={satellites} />
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

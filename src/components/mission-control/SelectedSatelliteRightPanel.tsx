import {
  SatelliteTelemetry,
  SatelliteState,
  SubsystemStatus,
} from "../../data/mockMissionControl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import Satellite3DPreview from "./Satellite3DPreview";

interface SelectedSatelliteRightPanelProps {
  satellite: SatelliteTelemetry;
  onOpenFaultModal: () => void;
  onResetSwarm: () => void;
  isAnyFaultActive: boolean;
}

export default function SelectedSatelliteRightPanel({
  satellite,
  onOpenFaultModal,
  onResetSwarm,
  isAnyFaultActive,
}: SelectedSatelliteRightPanelProps) {
  const getSubsystemStatusClass = (status: SubsystemStatus) => {
    switch (status) {
      case "NOMINAL":
        return "text-[#10B981]";
      case "WARNING":
        return "text-[#F59E0B]";
      case "DEGRADED":
        return "text-[#F97316]";
      case "FAILED":
        return "text-[#EF4444]";
      default:
        return "text-[#10B981]";
    }
  };

  return (
    <aside className="w-full lg:w-80 shrink-0 bg-[#080D15]/95 border-l border-white/6 flex flex-col justify-between p-6 select-none font-sans text-xs overflow-y-auto">
      <div className="space-y-5">
        {/* Header: Satellite Name & Status */}
        <div className="pb-4 border-b border-white/6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-medium text-white tracking-tight">
              {satellite.name}
            </h2>
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  satellite.state === "NOMINAL"
                    ? "bg-[#10B981]"
                    : satellite.state === "FAILED"
                    ? "bg-[#EF4444]"
                    : "bg-[#F59E0B]"
                }`}
              />
              <span
                className={
                  satellite.state === "NOMINAL"
                    ? "text-[#10B981]"
                    : satellite.state === "FAILED"
                    ? "text-[#EF4444]"
                    : "text-[#F59E0B]"
                }
              >
                {satellite.state.charAt(0) + satellite.state.slice(1).toLowerCase()}
              </span>
            </div>
          </div>
          <div className="text-xs text-[#7F8C9A] mt-1">
            {satellite.plane} / {satellite.slot} · {satellite.role.charAt(0) + satellite.role.slice(1).toLowerCase()}
          </div>
        </div>

        {/* Interactive 3D spacecraft inspector */}
        <Satellite3DPreview
          satelliteName={satellite.name}
          role={satellite.role}
          state={satellite.state}
          subsystems={satellite.subsystems}
        />

        {/* SECTION 1: Resources & Trust */}
        <div className="space-y-3">
          <div className="text-[11px] font-medium text-[#7F8C9A] uppercase tracking-wider">
            Resources
          </div>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
            <div className="flex justify-between items-baseline">
              <span className="text-[#7F8C9A]">Battery</span>
              <span className="text-white font-medium tabular-nums">{satellite.battery}%</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[#7F8C9A]">Propellant</span>
              <span className="text-white font-medium tabular-nums">{satellite.propellant}%</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[#7F8C9A]">Compute</span>
              <span className="text-white font-medium tabular-nums">{satellite.compute}%</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-[#7F8C9A]">Storage</span>
              <span className="text-white font-medium tabular-nums">{satellite.storage}%</span>
            </div>
          </div>
          <div className="pt-2 flex justify-between items-baseline text-xs border-t border-white/4">
            <span className="text-[#7F8C9A]">Byzantine Trust</span>
            <span className="text-white font-medium tabular-nums">{satellite.trust.toFixed(2)}</span>
          </div>
        </div>

        {/* SECTION 2: Subsystem Health */}
        <div className="space-y-3 pt-2">
          <div className="text-[11px] font-medium text-[#7F8C9A] uppercase tracking-wider">
            Subsystem Health
          </div>
          <div className="space-y-2 text-xs">
            {[
              { name: "Communications", status: satellite.subsystems.communications },
              { name: "Navigation", status: satellite.subsystems.navigation },
              { name: "Propulsion", status: satellite.subsystems.propulsion },
              { name: "Power", status: satellite.subsystems.power },
              { name: "Payload", status: satellite.subsystems.payload },
              { name: "Attitude Control", status: satellite.subsystems.attitudeControl },
            ].map(({ name, status }) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-[#F3F6F8]/80">{name}</span>
                <span className={`font-medium ${getSubsystemStatusClass(status)}`}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: Capabilities */}
        <div className="space-y-3 pt-2">
          <div className="text-[11px] font-medium text-[#7F8C9A] uppercase tracking-wider">
            Capabilities
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {[
              { label: "Sensing", active: satellite.capabilities.sensing },
              { label: "Relay", active: satellite.capabilities.relay },
              { label: "Navigation", active: satellite.capabilities.navigation },
              { label: "Compute", active: satellite.capabilities.compute },
              { label: "Storage", active: satellite.capabilities.storage },
              { label: "Maneuvering", active: satellite.capabilities.maneuvering },
            ].map(({ label, active }) => (
              <div
                key={label}
                className="flex items-center justify-between py-1 px-2 rounded bg-white/[0.03] border border-white/4"
              >
                <span className="text-[#7F8C9A]">{label}</span>
                <span className={active ? "text-[#10B981]" : "text-[#EF4444]"}>
                  {active ? "Active" : "Off"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 4: Autonomy Status */}
        <div className="space-y-2 pt-2">
          <div className="text-[11px] font-medium text-[#7F8C9A] uppercase tracking-wider">
            Autonomy Status
          </div>
          <p className="text-xs text-[#F3F6F8]/85 leading-relaxed">
            {satellite.autonomyStatus}
          </p>
        </div>
        {/* SECTION 5: Satellite Profile */}
        <div className="space-y-3 pt-2">
          <div className="text-[11px] font-medium text-[#7F8C9A] uppercase tracking-wider">
            Satellite Profile
          </div>

          <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] divide-y divide-white/[0.05]">
            <div className="px-3 py-2.5">
              <div className="text-[9px] uppercase tracking-wider text-[#536170]">
                Mission Use
              </div>
              <div className="mt-1 text-[10px] leading-relaxed text-[#D7DEE7]">
                {satellite.role === "COORDINATOR"
                  ? "Swarm coordination, peer-consensus support, Earth observation and relay assistance."
                  : satellite.role === "RELAY"
                  ? "Inter-satellite communications relay, network continuity and distributed data forwarding."
                  : satellite.role === "ISOLATED"
                  ? "Temporarily isolated spacecraft undergoing fault containment or autonomous recovery."
                  : "Earth observation, distributed sensing and cooperative swarm mission support."}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-3 py-3">
              <div>
                <div className="text-[9px] uppercase tracking-wider text-[#536170]">
                  Platform
                </div>
                <div className="mt-1 text-[10px] text-white">
                  CubeSat
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-[#536170]">
                  Launch / Deployment
                </div>
                <div className="mt-1 text-[10px] text-[#AAB5C2]">
                  Simulation asset
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-[#536170]">
                  Orbit
                </div>
                <div className="mt-1 text-[10px] text-white tabular-nums">
                  {satellite.altitudeKm} km LEO
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-[#536170]">
                  Inclination
                </div>
                <div className="mt-1 text-[10px] text-white tabular-nums">
                  {satellite.inclinationDeg}°
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-[#536170]">
                  Orbital Period
                </div>
                <div className="mt-1 text-[10px] text-white tabular-nums">
                  {satellite.orbitPeriodSec} min
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-[#536170]">
                  Assignment
                </div>
                <div className="mt-1 text-[10px] text-white">
                  {satellite.plane} · {satellite.slot}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-[#536170]">
                  Mission State
                </div>
                <div className="mt-1 text-[10px] text-[#10B981]">
                  {satellite.missionState}
                </div>
              </div>

              <div>
                <div className="text-[9px] uppercase tracking-wider text-[#536170]">
                  Swarm ID
                </div>
                <div className="mt-1 text-[10px] text-white">
                  {satellite.id}
                </div>
              </div>
            </div>

            <div className="px-3 py-2.5 text-[9px] leading-relaxed text-[#536170]">
              ASTRANET currently models this spacecraft as a simulated swarm asset.
              No real-world launch date is claimed.
            </div>
          </div>
        </div>

      </div>

      {/* Action Footer: Inject Fault & Reset buttons */}
      <div className="pt-6 border-t border-white/6 space-y-2 mt-6">
        <button
          onClick={onOpenFaultModal}
          className="w-full py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-medium text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Inject Fault</span>
        </button>

        {isAnyFaultActive && (
          <button
            onClick={onResetSwarm}
            className="w-full py-2 px-3 rounded-lg bg-[#10B981]/10 hover:bg-[#10B981]/20 border border-[#10B981]/30 text-xs text-[#10B981] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Swarm to Nominal</span>
          </button>
        )}
      </div>
    </aside>
  );
}

import { SatelliteTelemetry } from "../../data/mockMissionControl";

interface MetricsBottomBarProps {
  satellites: SatelliteTelemetry[];
}

export default function MetricsBottomBar({ satellites }: MetricsBottomBarProps) {
  const nominalCount = satellites.filter((s) => s.state === "NOMINAL").length;
  const degradedCount = satellites.filter(
    (s) => s.state === "DEGRADED" || s.state === "WARNING" || s.state === "SUSPECTED"
  ).length;
  const failedCount = satellites.filter(
    (s) => s.state === "FAILED" || s.state === "ISOLATED"
  ).length;

  return (
    <div className="w-full bg-[#080D15]/95 border-t border-white/6 px-6 py-3.5 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-sans select-none text-[#7F8C9A]">
      {/* Block 1: Swarm */}
      <div className="flex items-center gap-3">
        <span className="text-white font-medium">Swarm</span>
        <span>12 Total</span>
        <span>·</span>
        <span className="text-[#10B981] font-medium">{nominalCount} Nominal</span>
        <span>·</span>
        <span className={degradedCount > 0 ? "text-[#F59E0B] font-medium" : ""}>
          {degradedCount} Degraded
        </span>
        <span>·</span>
        <span className={failedCount > 0 ? "text-[#EF4444] font-medium" : ""}>
          {failedCount} Failed
        </span>
      </div>

      {/* Block 2: Network */}
      <div className="flex items-center gap-3">
        <span className="text-white font-medium">Network</span>
        <span>24 Links</span>
        <span>·</span>
        <span>18 ms Latency</span>
        <span>·</span>
        <span>0.4% Loss</span>
        <span>·</span>
        <span className="text-[#10B981] font-medium">Connected</span>
      </div>

      {/* Block 3: Mission */}
      <div className="flex items-center gap-3">
        <span className="text-white font-medium">Mission</span>
        <span>EO-01</span>
        <span>·</span>
        <span>Earth Observation + Relay</span>
        <span>·</span>
        <span className="text-[#10B981] font-medium">Nominal</span>
        <span>·</span>
        <span>Resilience: Calculating</span>
      </div>
    </div>
  );
}

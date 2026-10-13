import { MissionEvent, SatelliteTelemetry } from "../../data/mockMissionControl";

interface OperationsLeftPanelProps {
  events: MissionEvent[];
  satellites: SatelliteTelemetry[];
}

export default function OperationsLeftPanel({
  events,
  satellites,
}: OperationsLeftPanelProps) {
  const nominalCount = satellites.filter((s) => s.state === "NOMINAL").length;
  const degradedCount = satellites.filter(
    (s) => s.state === "DEGRADED" || s.state === "WARNING" || s.state === "SUSPECTED"
  ).length;
  const failedCount = satellites.filter(
    (s) => s.state === "FAILED" || s.state === "ISOLATED"
  ).length;

  // Show only 4 to 6 recent events for a quiet, uncluttered rail
  const recentEvents = events.slice(0, 5);

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-[#080D15]/95 border-r border-white/6 flex flex-col justify-between p-5 select-none font-sans text-xs">
      <div>
        {/* Header: Small "Operations" title and live chip */}
        <div className="flex items-center justify-between pb-3 border-b border-white/6">
          <div className="text-sm font-medium text-white">Operations</div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#10B981]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span>Live</span>
          </div>
        </div>

        {/* Tiny Swarm Summary */}
        <div className="py-3 border-b border-white/6 flex items-center gap-2 text-[11px] text-[#7F8C9A]">
          <span className="text-[#10B981] font-medium">{nominalCount} nominal</span>
          <span>·</span>
          <span className={degradedCount > 0 ? "text-[#F59E0B] font-medium" : ""}>
            {degradedCount} degraded
          </span>
          <span>·</span>
          <span className={failedCount > 0 ? "text-[#EF4444] font-medium" : ""}>
            {failedCount} failed
          </span>
        </div>

        {/* Concise Event Stream (4–6 events) */}
        <div className="pt-4 space-y-3">
          <div className="text-[11px] text-[#7F8C9A] uppercase tracking-wider font-medium">
            Recent Events
          </div>

          <div className="space-y-2.5">
            {recentEvents.map((ev) => (
              <div key={ev.id} className="text-xs leading-relaxed text-[#F3F6F8]/85">
                <span className="text-[#7F8C9A] tabular-nums font-mono mr-2 text-[11px]">
                  {ev.timestamp}
                </span>
                <span className="text-[#7F8C9A] mr-1.5">—</span>
                <span
                  className={
                    ev.severity === "critical"
                      ? "text-[#EF4444]"
                      : ev.severity === "warning"
                      ? "text-[#F59E0B]"
                      : ""
                  }
                >
                  {ev.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Text Link */}
      <div className="pt-4 border-t border-white/6 text-right">
        <button className="text-[11px] text-[#7F8C9A] hover:text-white transition-colors cursor-pointer">
          View all events →
        </button>
      </div>
    </aside>
  );
}

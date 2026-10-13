import { motion } from "framer-motion";
import { ArrowUpRight, Activity, Radio, Orbit, AlertTriangle, ShieldCheck } from "lucide-react";

interface MissionControlPreviewProps {
  onOpenContact: () => void;
}

const EVENT_LOGS = [
  {
    time: "18:32:11",
    level: "WARN",
    levelColor: "text-amber-400 bg-amber-950/50 border-amber-500/30",
    message: "SAT-04 heartbeat timeout",
  },
  {
    time: "18:32:14",
    level: "INFO",
    levelColor: "text-[#89AACC] bg-[#4E85BF]/10 border-[#4E85BF]/30",
    message: "Peer verification initiated",
  },
  {
    time: "18:32:16",
    level: "CONFIRM",
    levelColor: "text-emerald-400 bg-emerald-950/50 border-emerald-500/30",
    message: "4/5 nodes confirm failure",
  },
  {
    time: "18:32:17",
    level: "ISOLATE",
    levelColor: "text-rose-400 bg-rose-950/50 border-rose-500/30",
    message: "SAT-04 isolated from mesh",
  },
  {
    time: "18:32:18",
    level: "ELECTION",
    levelColor: "text-sky-400 bg-sky-950/50 border-sky-500/30",
    message: "Leader election initiated",
  },
  {
    time: "18:32:20",
    level: "ELECTED",
    levelColor: "text-emerald-300 bg-emerald-900/50 border-emerald-400/40 font-semibold",
    message: "SAT-07 elected coordinator",
  },
];

export default function MissionControlPreview({
  onOpenContact,
}: MissionControlPreviewProps) {
  return (
    <section
      id="mission-control"
      className="bg-bg py-20 md:py-28 relative z-20 border-t border-stroke/40"
    >
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
          className="mb-14 md:mb-16"
        >
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-4">
            <span className="w-8 h-px bg-stroke block" />
            <span className="text-xs text-muted uppercase tracking-[0.3em] font-medium">
              LIVE DIGITAL TWIN
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl text-text-primary tracking-tight font-light leading-[1.08]">
            Watch the swarm{" "}
            <span className="font-display italic text-5xl sm:text-6xl md:text-7xl font-normal text-white">
              think.
            </span>
          </h2>

          {/* Subtext */}
          <p className="text-sm md:text-base text-muted mt-4 max-w-2xl leading-relaxed font-light">
            Real-time orbital tracking, mesh network topology, Byzantine fault
            consensus, and relative formation telemetry inside the mission control cockpit.
          </p>
        </motion.div>

        {/* Large Rounded Cockpit Frame */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1] }}
          className="rounded-3xl bg-surface border border-stroke overflow-hidden shadow-2xl shadow-black relative"
        >
          {/* Top Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:px-8 border-b border-stroke/80 bg-bg/80 text-xs font-mono">
            {/* Left System Identity */}
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded bg-[#4E85BF]/20 border border-[#4E85BF]/40 text-[#89AACC] font-semibold tracking-wider">
                ASTRANET MC // LEO-SIM
              </span>
              <div className="flex items-center gap-2 text-emerald-400 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span>SWARM HEALTH: 98.4% NOMINAL</span>
              </div>
            </div>

            {/* Middle Coordinator Badge & Right Button */}
            <div className="flex items-center gap-4">
              <div className="text-xs text-muted flex items-center gap-1.5">
                <span>COORDINATOR:</span>
                <span className="text-white font-semibold px-2 py-0.5 rounded bg-surface border border-stroke">
                  SAT-07
                </span>
              </div>

              {/* Top-right Button */}
              <button
                onClick={onOpenContact}
                className="group relative inline-flex items-center gap-1.5 rounded-full text-xs font-mono uppercase tracking-wider font-medium px-4 py-2 cursor-pointer overflow-hidden border border-stroke bg-surface hover:border-transparent transition-all duration-300"
              >
                <span
                  className="absolute -inset-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 accent-gradient -z-10"
                  aria-hidden="true"
                />
                <span className="relative z-10 flex items-center gap-1 text-text-primary group-hover:text-white">
                  <span>ENTER MISSION CONTROL</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </button>
            </div>
          </div>

          {/* Main Visualizer Area */}
          <div className="relative min-h-[380px] sm:min-h-[460px] p-6 sm:p-10 flex flex-col justify-between overflow-hidden bg-gradient-to-b from-black via-surface/40 to-black">
            {/* Ambient Starfield & Grid Pattern */}
            <div
              className="absolute inset-0 halftone-overlay opacity-15 pointer-events-none"
              aria-hidden="true"
            />
            <div
              className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-[#4E85BF]/10 rounded-full blur-3xl pointer-events-none"
              aria-hidden="true"
            />

            {/* Top-left Telemetry Labels */}
            <div className="relative z-10 flex flex-wrap gap-2 text-[10px] font-mono tracking-widest uppercase">
              <span className="px-2.5 py-1 rounded bg-bg/80 border border-stroke text-muted">
                EARTH // LEO
              </span>
              <span className="px-2.5 py-1 rounded bg-bg/80 border border-stroke text-muted">
                RANGE: 1280 KM
              </span>
              <span className="px-2.5 py-1 rounded bg-[#4E85BF]/15 border border-[#4E85BF]/30 text-[#89AACC]">
                ISL MESH OPTIMAL
              </span>
              <span className="px-2.5 py-1 rounded bg-bg/80 border border-stroke text-muted">
                INTRA-SATELLITE LINKS: 20 NOMINAL
              </span>
            </div>

            {/* Central Orbital Diagram / Earth SVG */}
            <div className="relative w-full my-8 flex items-center justify-center">
              <svg
                viewBox="0 0 900 360"
                className="w-full max-w-[850px] h-auto overflow-visible select-none"
              >
                <defs>
                  {/* Earth Horizon Radial Glow */}
                  <radialGradient id="earthGlow" cx="50%" cy="100%" r="70%">
                    <stop offset="0%" stopColor="#4E85BF" stopOpacity="0.45" />
                    <stop offset="50%" stopColor="#1E3A5F" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                  </radialGradient>

                  {/* Atmosphere rim gradient */}
                  <linearGradient id="atmoRim" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#89AACC" stopOpacity="0.1" />
                    <stop offset="50%" stopColor="#4E85BF" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#89AACC" stopOpacity="0.1" />
                  </linearGradient>

                  {/* Laser line gradient */}
                  <linearGradient id="laserLine" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#89AACC" stopOpacity="0.6" />
                    <stop offset="50%" stopColor="#4E85BF" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#89AACC" stopOpacity="0.6" />
                  </linearGradient>
                </defs>

                {/* Curved Earth Horizon Body */}
                <ellipse
                  cx="450"
                  cy="460"
                  rx="480"
                  ry="210"
                  fill="url(#earthGlow)"
                />
                <ellipse
                  cx="450"
                  cy="460"
                  rx="480"
                  ry="210"
                  fill="none"
                  stroke="url(#atmoRim)"
                  strokeWidth="2.5"
                />

                {/* Concentric Orbital Trajectory Paths */}
                <ellipse
                  cx="450"
                  cy="320"
                  rx="410"
                  ry="170"
                  fill="none"
                  stroke="#4E85BF"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                  strokeOpacity="0.35"
                />
                <ellipse
                  cx="450"
                  cy="290"
                  rx="380"
                  ry="150"
                  fill="none"
                  stroke="#89AACC"
                  strokeWidth="1.5"
                  strokeOpacity="0.45"
                />

                {/* Inter-satellite laser link mesh paths */}
                <path
                  d="M 120 220 L 290 170 L 450 145 L 610 170 L 780 220"
                  fill="none"
                  stroke="url(#laserLine)"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  className="animate-pulse"
                />
                <path
                  d="M 290 170 L 610 170"
                  fill="none"
                  stroke="#4E85BF"
                  strokeWidth="1"
                  strokeOpacity="0.4"
                  strokeDasharray="2 4"
                />

                {/* SATELLITE 1: SAT-01 */}
                <g transform="translate(120, 220)">
                  <circle r="12" fill="#4E85BF" fillOpacity="0.15" />
                  <circle r="4.5" fill="#89AACC" />
                  <line x1="0" y1="0" x2="0" y2="-28" stroke="#89AACC" strokeWidth="1" strokeOpacity="0.6" />
                  <rect x="-30" y="-46" width="60" height="18" rx="4" fill="#0A0A0A" stroke="#333" strokeWidth="1" />
                  <text x="0" y="-34" fill="#E2E8F0" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="600">
                    SAT-01
                  </text>
                </g>

                {/* SATELLITE 2: SAT-02 */}
                <g transform="translate(290, 170)">
                  <circle r="12" fill="#4E85BF" fillOpacity="0.15" />
                  <circle r="4.5" fill="#89AACC" />
                  <line x1="0" y1="0" x2="0" y2="-28" stroke="#89AACC" strokeWidth="1" strokeOpacity="0.6" />
                  <rect x="-30" y="-46" width="60" height="18" rx="4" fill="#0A0A0A" stroke="#333" strokeWidth="1" />
                  <text x="0" y="-34" fill="#E2E8F0" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="600">
                    SAT-02
                  </text>
                </g>

                {/* SATELLITE 3: SAT-04 (LAGGING) */}
                <g transform="translate(450, 145)">
                  {/* Warning pulsation ring */}
                  <circle r="18" fill="#F59E0B" fillOpacity="0.15" className="animate-ping" />
                  <circle r="6" fill="#F59E0B" stroke="#FDE68A" strokeWidth="1.5" />
                  <line x1="0" y1="0" x2="0" y2="-32" stroke="#F59E0B" strokeWidth="1" strokeOpacity="0.8" />
                  <rect x="-55" y="-52" width="110" height="20" rx="4" fill="#1C1005" stroke="#F59E0B" strokeWidth="1.2" />
                  <text x="0" y="-38" fill="#FBBF24" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="700">
                    SAT-04 (LAGGING)
                  </text>
                </g>

                {/* SATELLITE 4: SAT-07 (COORD) - HIGHLIGHTED */}
                <g transform="translate(610, 170)">
                  <circle r="22" fill="#10B981" fillOpacity="0.15" />
                  <circle r="6.5" fill="#10B981" stroke="#A7F3D0" strokeWidth="2" />
                  <line x1="0" y1="0" x2="0" y2="-32" stroke="#10B981" strokeWidth="1" strokeOpacity="0.8" />
                  <rect x="-52" y="-52" width="104" height="20" rx="4" fill="#052014" stroke="#10B981" strokeWidth="1.5" />
                  <text x="0" y="-38" fill="#34D399" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="700">
                    SAT-07 (COORD)
                  </text>
                </g>

                {/* SATELLITE 5: SAT-11 */}
                <g transform="translate(780, 220)">
                  <circle r="12" fill="#4E85BF" fillOpacity="0.15" />
                  <circle r="4.5" fill="#89AACC" />
                  <line x1="0" y1="0" x2="0" y2="-28" stroke="#89AACC" strokeWidth="1" strokeOpacity="0.6" />
                  <rect x="-30" y="-46" width="60" height="18" rx="4" fill="#0A0A0A" stroke="#333" strokeWidth="1" />
                  <text x="0" y="-34" fill="#E2E8F0" fontSize="9" fontFamily="monospace" textAnchor="middle" fontWeight="600">
                    SAT-11
                  </text>
                </g>
              </svg>
            </div>

            {/* Bottom Diagram Legend */}
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-stroke/60 text-[11px] font-mono text-muted">
              <div className="flex items-center gap-5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  COORDINATOR
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#89AACC]" />
                  NOMINAL NODE
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  ANOMALOUS / LAGGING
                </span>
              </div>
              <span className="text-muted/60">HCW ORBIT FRAME // +VBAR SYNC</span>
            </div>
          </div>

          {/* Event Log Panel */}
          <div className="p-6 sm:p-8 border-t border-stroke bg-bg/95">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-stroke/60 text-xs font-mono">
              <span className="text-xs uppercase tracking-widest text-[#89AACC] font-medium flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-[#4E85BF]" />
                REAL-TIME EVENT LOG // TELEMETRY FEED
              </span>
              <span className="text-[11px] text-muted">BUFFER: 6 FRAMES</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              {EVENT_LOGS.map((event, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-2 sm:px-3 rounded-lg bg-surface/40 hover:bg-surface border border-stroke/50 transition-colors"
                >
                  <span className="text-muted/70 tracking-wider shrink-0 tabular-nums">
                    {event.time}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase border shrink-0 ${event.levelColor}`}
                  >
                    {event.level}
                  </span>
                  <span className="text-text-primary/90 font-light truncate">
                    {event.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Metric Cards (2 Columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 sm:p-8 border-t border-stroke bg-surface/50">
            {/* Left Card: Resilience Score */}
            <div className="rounded-2xl p-6 bg-bg/80 border border-stroke relative overflow-hidden group">
              <span className="text-[11px] font-mono text-muted uppercase tracking-[0.2em] block mb-2 font-medium">
                RESILIENCE SCORE
              </span>
              <div className="text-4xl sm:text-5xl font-display italic text-white tracking-tight mb-1 tabular-nums">
                98.4%
              </div>
              <div className="text-xs font-mono text-emerald-400 tracking-wider font-semibold">
                MISSION STABILITY
              </div>
            </div>

            {/* Right Card: Leader Status */}
            <div className="rounded-2xl p-6 bg-bg/80 border border-stroke relative overflow-hidden group">
              <span className="text-[11px] font-mono text-muted uppercase tracking-[0.2em] block mb-2 font-medium">
                LEADER STATUS
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-medium text-white tracking-tight mb-1">
                SAT-07
              </div>
              <div className="text-xs font-mono text-[#89AACC] tracking-wider font-semibold">
                TERM 104 COORDINATOR
              </div>
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="p-6 sm:px-8 bg-bg/90 border-t border-stroke flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-xs sm:text-sm text-muted font-light leading-relaxed text-center md:text-left max-w-xl">
              Ready to break and recover the swarm? Launch the interactive
              Mission Control simulator to inject live orbital faults.
            </p>

            {/* Bottom-right CTA Button */}
            <button
              onClick={onOpenContact}
              className="group relative rounded-full text-xs font-mono uppercase tracking-wider font-medium px-7 py-3.5 transition-all duration-300 hover:scale-105 cursor-pointer overflow-hidden border border-stroke bg-surface hover:border-transparent shrink-0"
            >
              {/* Gradient border ring on hover */}
              <span
                className="absolute -inset-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 accent-gradient -z-10"
                aria-hidden="true"
              />
              <span className="relative z-10 flex items-center gap-2 text-text-primary group-hover:text-white">
                <span>ENTER MISSION CONTROL</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

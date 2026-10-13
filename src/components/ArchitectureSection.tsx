import { motion } from "framer-motion";
import { CheckCircle2, ShieldCheck, Activity, Cpu } from "lucide-react";

interface ArchitectureSectionProps {
  onOpenContact?: () => void;
}

const ARCHITECTURE_STACK = [
  {
    step: "01",
    category: "CONSTELLATION",
    title: "Spacecraft Swarm",
    description:
      "12 LEO CubeSat nodes in coordinated orbit with RF & optical ISL links.",
    rightLabel: "PHYSICAL LAYER",
    highlight: false,
  },
  {
    step: "02",
    category: "INGESTION",
    title: "Telemetry Layer",
    description:
      "High frequency state vectors, attitude quaternions, and battery bus voltages.",
    rightLabel: "OBSERVABILITY",
    highlight: false,
  },
  {
    step: "03",
    category: "DIAGNOSTICS",
    title: "Fault Detection",
    description:
      "Local Kalman filtering and beacon watchdog monitors flag anomalous nodes.",
    rightLabel: "LOCAL INFERENCE",
    highlight: false,
  },
  {
    step: "04",
    category: "VERIFICATION",
    title: "Peer Consensus",
    description:
      "Byzantine-fault-tolerant cross-verification eliminates false alarm triggers.",
    rightLabel: "DISTRIBUTED CONSENSUS",
    highlight: true,
  },
  {
    step: "05",
    category: "REASONING",
    title: "Autonomy Engine",
    description:
      "Decentralized state machine assessing mission impact and safety constraints.",
    rightLabel: "DECISION CORE",
    highlight: false,
  },
  {
    step: "06",
    category: "COORDINATION",
    title: "Leader Election",
    description:
      "Dynamic Raft election promotes highest-energy node to swarm coordinator.",
    rightLabel: "DYNAMIC LEADERSHIP",
    highlight: false,
  },
  {
    step: "07",
    category: "TOPOLOGY",
    title: "Role Reallocation",
    description:
      "Sensor duty cycles, telemetry relay duties, and downlink windows reassigned.",
    rightLabel: "GRAPH REWRITING",
    highlight: false,
  },
  {
    step: "08",
    category: "GUIDANCE",
    title: "Formation Optimizer",
    description:
      "Relative orbital mechanics solver computes propellant-minimal burn bursts.",
    rightLabel: "RPO ORBITAL SOLVER",
    highlight: false,
  },
  {
    step: "09",
    category: "CLOSURE",
    title: "Recovery Execution",
    description:
      "Autonomous thruster burn execution and constellation coverage restoration.",
    rightLabel: "CLOSED-LOOP RECOVERY",
    highlight: false,
  },
];

export default function ArchitectureSection({
  onOpenContact,
}: ArchitectureSectionProps) {
  return (
    <section
      id="architecture"
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
              LIVE SWARM ARCHITECTURE
            </span>
          </div>

          {/* Heading */}
          <h2 className="text-4xl sm:text-5xl md:text-6xl text-text-primary tracking-tight font-light max-w-3xl leading-[1.08]">
            Intelligence distributed{" "}
            <span className="font-display italic text-5xl sm:text-6xl md:text-7xl font-normal text-white">
              across the swarm.
            </span>
          </h2>

          {/* Subtext */}
          <p className="text-sm md:text-base text-muted mt-4 max-w-2xl leading-relaxed font-light">
            No single point of failure. Every satellite carries autonomous fault
            detection, participates in leader elections, and calculates relative
            trajectory solutions locally.
          </p>
        </motion.div>

        {/* 9 Architecture Stack Cards */}
        <div className="flex flex-col gap-3.5 sm:gap-4 mb-14 md:mb-16">
          {ARCHITECTURE_STACK.map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{
                duration: 0.6,
                delay: index * 0.05,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className={`group relative rounded-2xl md:rounded-3xl p-5 sm:p-6 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-4 border ${
                item.highlight
                  ? "bg-surface/90 border-[#4E85BF]/70 shadow-[0_0_30px_rgba(78,133,191,0.18)] ring-1 ring-[#89AACC]/30"
                  : "bg-surface/40 hover:bg-surface/75 border-stroke hover:border-white/20"
              }`}
            >
              {/* Highlight active ambient indicator bar */}
              {item.highlight && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1.5 accent-gradient rounded-l-2xl"
                  aria-hidden="true"
                />
              )}

              {/* Left Details */}
              <div className="flex items-start gap-4 sm:gap-6 min-w-0">
                {/* Step & Category tag */}
                <div className="flex flex-col shrink-0 min-w-[70px] sm:min-w-[85px]">
                  <div className="flex items-center gap-1.5">
                    {item.highlight && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4E85BF] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                      </span>
                    )}
                    <span
                      className={`text-xs font-mono font-medium tracking-wider ${
                        item.highlight ? "text-emerald-400" : "text-[#89AACC]"
                      }`}
                    >
                      {item.step}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted tracking-widest uppercase mt-0.5">
                    {item.category}
                  </span>
                </div>

                {/* Title & Description */}
                <div className="min-w-0 pr-2">
                  <h3
                    className={`text-base sm:text-lg font-medium tracking-tight mb-1 transition-colors ${
                      item.highlight
                        ? "text-white"
                        : "text-text-primary group-hover:text-white"
                    }`}
                  >
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted font-light leading-relaxed max-w-xl">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Right Subsystem Label */}
              <div className="flex md:justify-end items-center shrink-0 pl-16 md:pl-0">
                <span
                  className={`text-[10px] sm:text-xs font-mono tracking-widest uppercase px-3 py-1.5 rounded-lg border transition-colors ${
                    item.highlight
                      ? "bg-[#4E85BF]/20 border-[#4E85BF]/60 text-white font-medium"
                      : "bg-bg/80 border-stroke text-muted group-hover:text-text-primary"
                  }`}
                >
                  {item.rightLabel}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* FEATURE 2: Subsystem Telemetry Monitor Panel */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative rounded-3xl bg-surface/80 border border-[#4E85BF]/40 p-6 sm:p-10 md:p-12 overflow-hidden shadow-2xl shadow-black/80"
        >
          {/* Subtle background gradient glow */}
          <div
            className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-[#4E85BF]/10 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 -ml-24 -mb-24 w-80 h-80 bg-[#89AACC]/5 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          {/* Top Status Bar */}
          <div className="flex items-center justify-between pb-6 border-b border-stroke/70 text-xs font-mono">
            {/* Top-left small status */}
            <div className="flex items-center gap-2 text-emerald-400 font-medium tracking-wider">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span>● SUBSYSTEM TELEMETRY MONITOR</span>
            </div>

            {/* Top-right small label */}
            <div className="text-muted tracking-widest uppercase">
              MODE // B4
            </div>
          </div>

          {/* Panel Header */}
          <div className="mt-8 mb-6">
            <span className="text-[11px] font-mono text-[#89AACC] tracking-widest uppercase block mb-1.5 font-medium">
              DISTRIBUTED CONSENSUS
            </span>
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-display italic text-text-primary tracking-tight">
              Peer Consensus
            </h3>
            <p className="text-sm sm:text-base text-muted mt-3 max-w-2xl font-light leading-relaxed">
              Byzantine-fault-tolerant cross-verification eliminates false alarm triggers.
            </p>
          </div>

          {/* Inner State Vector Box */}
          <div className="rounded-2xl bg-bg/90 border border-stroke p-5 sm:p-7 my-7 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-muted tracking-[0.25em] block mb-1">
                  STATE VECTOR
                </span>
                <div className="text-lg sm:text-2xl font-mono font-medium text-white tracking-tight">
                  QUORUM CONFIRMED: 4/5 PEERS
                </div>
              </div>

              {/* Right-aligned status tag */}
              <div className="shrink-0 self-start sm:self-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium tracking-wider bg-emerald-950/70 border border-emerald-500/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  SYNCHRONIZED
                </span>
              </div>
            </div>

            {/* Small technical line below */}
            <div className="pt-4 border-t border-stroke/70 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs font-mono text-[#89AACC] tracking-wider">
              <span>LATENCY: 12ms</span>
              <span className="text-muted/40">·</span>
              <span>LOSS: 0.80%</span>
              <span className="text-muted/40">·</span>
              <span>JITTER: 0.4ms</span>
            </div>
          </div>

          {/* Bullet points */}
          <div className="space-y-3 mb-8">
            {[
              "No reliance on ground-time-loop uplinks",
              "Cryptographic epoch signatures prevent replay attacks",
              "Real-time Hill-Clohessy-Wiltshire trajectory bounds",
            ].map((bullet, idx) => (
              <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-text-primary/90 font-light">
                <CheckCircle2 className="w-4 h-4 text-[#4E85BF] shrink-0" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>

          {/* Bottom thin strip label */}
          <div className="pt-6 border-t border-stroke/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-mono text-muted/80 tracking-widest">
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#89AACC]" />
              <span>SPACECRAFT ISL PROTOCOL // MESH-STD-7353 COMPLIANT PARSER</span>
            </div>
            <div className="text-muted/50">LEO CLUSTER BUS v4.2</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

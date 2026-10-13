import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";

export interface JournalArticle {
  id: string;
  title: string;
  italicWord: string;
  date: string;
  readTime: string;
  category: string;
  excerpt: string;
  content: string[];
  thumbnail: string;
}

export const JOURNAL_ENTRIES: JournalArticle[] = [
  {
    id: "detect-anomalies",
    title: "Detect — Identify telemetry anomalies and communication loss",
    italicWord: "Detect",
    date: "Stage 01",
    readTime: "Phase 1",
    category: "Telemetry Analysis",
    thumbnail: "/src/assets/images/recovery_detect.jpg",
    excerpt:
      "Continuous onboard sensor diagnostics cross-evaluate attitude, power draw, and beacon heartbeats against dynamic orbital nominal thresholds.",
    content: [
      "Continuous onboard sensor diagnostics cross-evaluate attitude, power draw, and beacon heartbeats against dynamic orbital nominal thresholds.",
      "Upon detecting a persistent anomaly or abrupt communication blackout, the node flags an internal fault state and initiates peer verification protocols.",
    ],
  },
  {
    id: "verify-failure",
    title: "Verify — Neighboring nodes confirm spacecraft failure",
    italicWord: "Verify",
    date: "Stage 02",
    readTime: "Phase 2",
    category: "Consensus Quorum",
    thumbnail: "/src/assets/images/recovery_verify.jpg",
    excerpt:
      "Neighboring spacecraft poll anomalous nodes across inter-satellite cross-links to reach Byzantine consensus.",
    content: [
      "To prevent premature or false-positive failovers, adjacent swarm members broadcast localized polling pings across inter-satellite links.",
      "Once a two-thirds majority quorum confirms unresponsive telemetry or anomalous trajectory drift, the failure state is cryptographically signed and broadcast.",
    ],
  },
  {
    id: "reconfigure-roles",
    title: "Reconfigure — Reassign roles, links and leadership",
    italicWord: "Reconfigure",
    date: "Stage 03",
    readTime: "Phase 3",
    category: "Mesh Restructuring",
    thumbnail: "/src/assets/images/recovery_reconfigure.jpg",
    excerpt:
      "The surviving constellation members execute distributed election algorithms to reassign critical observation tasks and ground downlink relays.",
    content: [
      "The surviving constellation members execute distributed election algorithms to reassign critical observation tasks and ground downlink relays.",
      "Dynamic mesh routing updates ensure unbroken communication channels across the remaining active nodes without telemetry interruption.",
    ],
  },
  {
    id: "recover-formation",
    title: "Recover — Restore mission-capable swarm formation",
    italicWord: "Recover",
    date: "Stage 04",
    readTime: "Phase 4",
    category: "Kinematic Restoration",
    thumbnail: "/src/assets/images/recovery_recover.jpg",
    excerpt:
      "Surviving nodes compute collision-free orbital maneuvers to close formation gaps and redistribute spatial coverage evenly.",
    content: [
      "Surviving nodes compute collision-free orbital maneuvers to close formation gaps and redistribute spatial coverage evenly.",
      "Differential drag and pulsed plasma micro-thrusters drive the constellation back to full operational geometry, guaranteeing continuous mission success.",
    ],
  },
];

interface JournalProps {
  onSelectArticle: (article: JournalArticle) => void;
  onViewAllThoughts: () => void;
}

export default function Journal({
  onSelectArticle,
  onViewAllThoughts,
}: JournalProps) {
  return (
    <section id="journal" className="bg-bg py-16 md:py-24 relative z-20">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
        {/* Header (same pattern) */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-16 gap-6"
        >
          <div>
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-4">
              <span className="w-8 h-px bg-stroke block" />
              <span className="text-xs text-muted uppercase tracking-[0.3em] font-medium">
                Recovery Pipeline
              </span>
            </div>

            {/* Heading */}
            <h2 className="text-4xl sm:text-5xl md:text-6xl text-text-primary tracking-tight font-light">
              Recovery{" "}
              <span className="font-display italic text-5xl sm:text-6xl md:text-7xl font-normal text-white">
                Pipeline
              </span>
            </h2>

            {/* Subtext */}
            <p className="text-sm md:text-base text-muted mt-3 max-w-lg">
              Autonomous multi-stage response sequence executed across distributed CubeSat nodes upon anomaly detection.
            </p>
          </div>

          {/* Desktop "Explore Pipeline" button */}
          <button
            onClick={onViewAllThoughts}
            className="group relative hidden md:inline-flex items-center gap-2 rounded-full text-xs uppercase tracking-wider font-medium px-6 py-3 cursor-pointer overflow-hidden border border-stroke bg-surface hover:border-transparent transition-all duration-300 shrink-0"
          >
            <span
              className="absolute -inset-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 accent-gradient -z-10"
              aria-hidden="true"
            />
            <span className="relative z-10 flex items-center gap-2 text-text-primary">
              Explore Pipeline
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </button>
        </motion.div>

        {/* 4 horizontal pills list */}
        <div className="flex flex-col gap-4">
          {JOURNAL_ENTRIES.map((entry, index) => (
            <motion.div
              key={entry.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{
                duration: 0.6,
                delay: index * 0.08,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              onClick={() => onSelectArticle(entry)}
              className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 p-4 sm:p-5 rounded-[40px] sm:rounded-full bg-surface/30 hover:bg-surface border border-stroke transition-all duration-300 hover:border-white/20 cursor-pointer overflow-hidden"
            >
              {/* Subtle hover accent line */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 accent-gradient opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-l-full"
                aria-hidden="true"
              />

              <div className="flex items-center gap-4 sm:gap-6 min-w-0">
                {/* Thumbnail */}
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden shrink-0 border border-stroke/80 bg-surface">
                  <img
                    src={entry.thumbnail}
                    alt={entry.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                </div>

                {/* Title & Metadata */}
                <div className="min-w-0">
                  <div className="text-xs text-muted font-normal tracking-wide flex items-center gap-2 mb-1">
                    <span>{entry.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{entry.readTime}</span>
                  </div>
                  <h3 className="text-base sm:text-lg md:text-xl text-text-primary font-medium tracking-tight group-hover:text-white transition-colors truncate">
                    {entry.title.split(entry.italicWord)[0]}
                    <span className="font-display italic text-lg sm:text-xl md:text-2xl text-white">
                      {entry.italicWord}
                    </span>
                    {entry.title.split(entry.italicWord)[1]}
                  </h3>
                </div>
              </div>

              {/* Date & Link arrow */}
              <div className="flex items-center justify-between sm:justify-end gap-6 sm:pr-4 pl-16 sm:pl-0 shrink-0">
                <span className="text-xs text-muted font-mono tabular-nums tracking-wider uppercase">
                  {entry.date}
                </span>
                <div className="w-8 h-8 rounded-full bg-stroke/40 group-hover:bg-white group-hover:text-black flex items-center justify-center transition-all duration-300 text-muted">
                  <ArrowUpRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile View All Button */}
        <div className="mt-8 flex justify-center md:hidden">
          <button
            onClick={onViewAllThoughts}
            className="inline-flex items-center gap-2 rounded-full text-xs uppercase tracking-wider font-medium px-6 py-3 border border-stroke bg-surface text-text-primary"
          >
            Explore Pipeline
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

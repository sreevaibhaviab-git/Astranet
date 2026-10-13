import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export interface Project {
  id: string;
  title: string;
  italicWord: string;
  category: string;
  year: string;
  role: string;
  description: string;
  image: string;
  colSpan: string;
  aspectRatio: string;
  tags: string[];
}

export const PROJECTS: Project[] = [
  {
    id: "distributed-fault-detection",
    title: "Distributed Fault Detection",
    italicWord: "Detection",
    category: "Telemetry & Diagnostics",
    year: "2026",
    role: "Fault Detection Subsystem",
    description:
      "Real-time telemetry analysis and decentralized anomaly identification across the CubeSat swarm, enabling sub-second detection of sensor and thruster anomalies.",
    image: "/src/assets/images/automotive_motion_1791897232216.jpg",
    colSpan: "md:col-span-7",
    aspectRatio: "aspect-[16/10] md:aspect-[16/9]",
    tags: ["Telemetry", "Anomaly Detection", "Consensus", "Fault Isolation"],
  },
  {
    id: "peer-failure-verification",
    title: "Peer Failure Verification",
    italicWord: "Verification",
    category: "Consensus & Cross-Validation",
    year: "2026",
    role: "Quorum Verification Engine",
    description:
      "Multi-agent peer cross-verification protocol ensuring false alarms are filtered and hardware failures are validated by neighboring orbital nodes.",
    image: "/src/assets/images/urban_architecture_1791897231907.jpg",
    colSpan: "md:col-span-5",
    aspectRatio: "aspect-[4/3] md:aspect-[4/3]",
    tags: ["Byzantine Fault Tolerance", "Peer Validation", "Quorum", "Cross-Link"],
  },
  {
    id: "self-healing-coordination",
    title: "Self-Healing Coordination",
    italicWord: "Coordination",
    category: "Decentralized Swarm Recovery",
    year: "2026",
    role: "Autonomous Coordinator",
    description:
      "Automated topology restructuring and task reassignment protocols that dynamically restore swarm functionality following node dropouts.",
    image: "/src/assets/images/human_perspective_1791897232750.jpg",
    colSpan: "md:col-span-5",
    aspectRatio: "aspect-[4/3] md:aspect-[4/3]",
    tags: ["Dynamic Reconfiguration", "Mesh Network", "Autonomous Healing", "State Machine"],
  },
  {
    id: "adaptive-formation-control",
    title: "Adaptive Formation Control",
    italicWord: "Control",
    category: "Orbital Mechanics & Kinematics",
    year: "2026",
    role: "Kinematic Guidance Engine",
    description:
      "Collision-free trajectory re-planning and station-keeping algorithms to maintain optimal swarm geometry and inter-satellite communication links.",
    image: "/src/assets/images/brand_identity_1791897232807.jpg",
    colSpan: "md:col-span-7",
    aspectRatio: "aspect-[16/10] md:aspect-[16/9]",
    tags: ["Trajectory Optimization", "Collision Avoidance", "Station Keeping", "Relative Navigation"],
  },
];

interface SelectedWorksProps {
  onSelectProject: (project: Project) => void;
  onViewAllWork: () => void;
}

export default function SelectedWorks({
  onSelectProject,
  onViewAllWork,
}: SelectedWorksProps) {
  return (
    <section id="work" className="bg-bg py-16 md:py-24 relative z-20">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
        {/* Header */}
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
                Core Capabilities
              </span>
            </div>

            {/* Heading */}
            <h2 className="text-4xl sm:text-5xl md:text-6xl text-text-primary tracking-tight font-light">
              Built to survive{" "}
              <span className="font-display italic text-5xl sm:text-6xl md:text-7xl font-normal text-white">
                failure
              </span>
            </h2>

            {/* Subtext */}
            <p className="text-sm md:text-base text-muted mt-3 max-w-lg">
              Decentralized autonomous protocols engineered for orbital resilience and swarm survivability.
            </p>
          </div>

          {/* Desktop "Explore System" button */}
          <button
            onClick={onViewAllWork}
            className="group relative hidden md:inline-flex items-center gap-2 rounded-full text-xs uppercase tracking-wider font-medium px-6 py-3 cursor-pointer overflow-hidden border border-stroke bg-surface hover:border-transparent transition-all duration-300 shrink-0"
          >
            {/* Animated gradient ring on hover */}
            <span
              className="absolute -inset-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 accent-gradient -z-10"
              aria-hidden="true"
            />
            <span className="relative z-10 flex items-center gap-2 text-text-primary">
              Explore System
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </button>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6">
          {PROJECTS.map((project, idx) => (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.8,
                delay: idx * 0.1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              onClick={() => onSelectProject(project)}
              className={`group relative overflow-hidden rounded-3xl bg-surface border border-stroke cursor-pointer transition-all duration-500 hover:border-white/20 hover:shadow-2xl hover:shadow-black/50 ${project.colSpan}`}
            >
              <div className={`w-full ${project.aspectRatio} relative overflow-hidden`}>
                {/* Background Image */}
                <img
                  src={project.image}
                  alt={project.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                />

                {/* Halftone overlay */}
                <div
                  className="absolute inset-0 halftone-overlay opacity-25 mix-blend-multiply pointer-events-none"
                  aria-hidden="true"
                />

                {/* Subtle base gradient for legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-bg/90 via-bg/20 to-transparent pointer-events-none" />

                {/* Card Quiet Bottom Metadata (always visible) */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 flex items-end justify-between z-10 pointer-events-none">
                  <div>
                    <div className="text-xs text-muted font-medium tracking-wide mb-1">
                      {project.category} · {project.year}
                    </div>
                    <h3 className="text-xl sm:text-2xl md:text-3xl text-text-primary font-medium tracking-tight">
                      {project.title.split(project.italicWord)[0]}
                      <span className="font-display italic text-2xl sm:text-3xl md:text-4xl text-white">
                        {project.italicWord}
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Hover Backdrop Blur & Overlay */}
                <div className="absolute inset-0 bg-bg/70 opacity-0 group-hover:opacity-100 backdrop-blur-lg transition-all duration-400 flex items-center justify-center p-6 z-20">
                  {/* Hover label: pill with animated gradient border, white bg */}
                  <div className="relative group/pill p-[2px] rounded-full overflow-hidden shadow-xl transform translate-y-3 group-hover:translate-y-0 transition-transform duration-400">
                    {/* Animated gradient ring */}
                    <div className="absolute inset-0 rounded-full accent-gradient animate-gradient-shift" />
                    {/* Inner White Pill */}
                    <div className="relative bg-white text-black px-6 py-3 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-2">
                      <span>View —</span>
                      <span className="font-display italic text-base capitalize tracking-normal font-normal text-black">
                        {project.title}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile View All Work Button */}
        <div className="mt-8 flex justify-center md:hidden">
          <button
            onClick={onViewAllWork}
            className="inline-flex items-center gap-2 rounded-full text-xs uppercase tracking-wider font-medium px-6 py-3 border border-stroke bg-surface text-text-primary"
          >
            Explore System
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

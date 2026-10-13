import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Briefcase, Award, GraduationCap, CheckCircle } from "lucide-react";
import { useState } from "react";

interface ResumeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ResumeModal({ isOpen, onClose }: ResumeModalProps) {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    // Generate mission spec text file download
    const cvContent = `ASTRANET — Autonomous Self-Healing CubeSat Swarm
Mission Architecture & Flight Subsystem Specification
Ctrl Freaks • 2026

MISSION OVERVIEW
A decentralized coordination framework for resilient CubeSat swarms in low Earth orbit. Provides autonomous fault isolation, Byzantine consensus verification, dynamic link reconfiguration, and station-keeping recovery without ground-in-the-loop dependencies.

SYSTEM MILESTONES
• Phase 01: Telemetry & Quorum Verification (Operational)
  Continuous health heartbeat monitoring and peer cross-validation across 12 spacecraft nodes.
• Phase 02: Dynamic Reconfiguration (Active)
  Autonomous role reassignment and optical link re-routing following simulated thruster or communication loss.
• Phase 03: Swarm Recovery & Station-Keeping (Validated)
  Station-keeping maintenance and collision-free trajectory re-planning to restore full mission capabilities.

CORE CAPABILITIES
Distributed Fault Detection, Peer Failure Verification, Self-Healing Coordination, Adaptive Formation Control, ISL Laser Cross-Links, Byzantine Fault Tolerance.
`;
    const blob = new Blob([cvContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ASTRANET_Mission_Spec.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-3xl bg-surface border border-stroke rounded-3xl overflow-hidden flex flex-col shadow-2xl shadow-black max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-stroke/70 bg-bg/50">
            <div>
              <span className="text-xs text-muted uppercase tracking-[0.2em] font-medium block">
                Mission Architecture
              </span>
              <h2 className="text-2xl sm:text-3xl font-display italic text-text-primary">
                ASTRANET Swarm
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-stroke bg-bg/80 text-xs font-medium text-text-primary hover:text-white hover:border-white/20 transition-all cursor-pointer"
              >
                {downloadSuccess ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Saved!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Mission Spec</span>
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2.5 rounded-full border border-stroke hover:bg-stroke/50 text-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="overflow-y-auto p-6 sm:p-8 space-y-8">
            {/* Summary */}
            <div className="p-5 rounded-2xl bg-bg/50 border border-stroke">
              <div className="text-xs uppercase tracking-widest text-[#89AACC] font-mono mb-2">
                Mission Profile
              </div>
              <p className="text-sm text-text-primary/90 font-light leading-relaxed">
                ASTRANET is a decentralized, autonomous self-healing CubeSat swarm architecture
                designed for resilient low Earth orbit operations. Operating without ground-in-the-loop
                latency, the swarm independently detects telemetry anomalies, verifies peer failures via
                Byzantine consensus, and reconfigures orbital formations in real time.
              </p>
            </div>

            {/* Experience Timeline */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted font-medium">
                <Briefcase className="w-4 h-4 text-[#4E85BF]" />
                <span>Mission Phases & Operations</span>
              </div>

              <div className="space-y-4 border-l border-stroke/70 pl-4 ml-2">
                <div>
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-sm sm:text-base font-medium text-white">
                      Phase 01: Telemetry & Quorum Verification
                    </h4>
                    <span className="text-xs text-muted font-mono">2026 — Operational</span>
                  </div>
                  <div className="text-xs text-[#89AACC]">Distributed ISL Mesh · Low Earth Orbit</div>
                  <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
                    Continuous health heartbeat monitoring and peer cross-validation across 12 spacecraft nodes.
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-sm sm:text-base font-medium text-white">
                      Phase 02: Dynamic Reconfiguration
                    </h4>
                    <span className="text-xs text-muted font-mono">2026 — Active</span>
                  </div>
                  <div className="text-xs text-[#89AACC]">Autonomous Formation Engine · On-Orbit</div>
                  <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
                    Autonomous role reassignment and optical link re-routing following simulated thruster or communication loss.
                  </p>
                </div>

                <div>
                  <div className="flex items-baseline justify-between">
                    <h4 className="text-sm sm:text-base font-medium text-white">
                      Phase 03: Swarm Recovery & Station-Keeping
                    </h4>
                    <span className="text-xs text-muted font-mono">2025 — Validated</span>
                  </div>
                  <div className="text-xs text-[#89AACC]">Kinematic Guidance Subsystem · Flight Simulation</div>
                  <p className="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
                    Station-keeping maintenance and collision-free trajectory re-planning to restore full mission capabilities.
                  </p>
                </div>
              </div>
            </div>

            {/* Core Competencies */}
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted font-medium mb-3">
                <Award className="w-4 h-4 text-[#4E85BF]" />
                <span>Subsystems & Flight Stack</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {[
                  "ISL Laser Mesh",
                  "Byzantine Quorum",
                  "Orbital Kinematics",
                  "Dynamic Routing",
                  "Fault Detection Engine",
                  "Autonomous State Machine",
                  "Telemetry Synchronization",
                  "Collision Avoidance",
                  "Decentralized Tasking",
                ].map((skill) => (
                  <div
                    key={skill}
                    className="p-2.5 rounded-xl bg-bg border border-stroke text-text-primary/90 flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4E85BF]" />
                    <span>{skill}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-bg/40 border border-stroke text-xs">
              <GraduationCap className="w-5 h-5 text-muted shrink-0" />
              <div>
                <span className="font-medium text-text-primary">
                  Ctrl Freaks Space Systems Research Group
                </span>
                <span className="text-muted block">Autonomous Space Systems Laboratory • 2026</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

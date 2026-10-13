import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Code2, ArrowUpRight } from "lucide-react";
import { ExplorationItem } from "./Explorations";

interface ExplorationModalProps {
  item: ExplorationItem | null;
  onClose: () => void;
}

export default function ExplorationModal({
  item,
  onClose,
}: ExplorationModalProps) {
  if (!item) return null;

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
                {item.category}
              </span>
              <h2 className="text-2xl sm:text-3xl font-display italic text-text-primary">
                {item.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-full border border-stroke hover:bg-stroke/50 text-muted hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Media Body */}
          <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
            <div className="rounded-2xl overflow-hidden border border-stroke aspect-square max-h-[420px] mx-auto bg-black relative">
              <img
                src={item.image}
                alt={item.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-xs font-mono text-[#89AACC]">
                  {item.technique}
                </span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-bg/60 border border-stroke space-y-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted">
                <Code2 className="w-4 h-4 text-[#4E85BF]" />
                <span>Fault Dynamics & Recovery Stack</span>
              </div>
              <p className="text-sm text-text-primary/90 leading-relaxed font-light">
                Simulated under orbital multi-agent conditions to validate autonomous self-healing, peer consensus, and formation recovery protocols under extreme spaceflight anomalies.
              </p>
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-muted">
                Scenario # {item.id.replace("exp-", "0")}
              </span>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-xs text-text-primary hover:text-white underline underline-offset-4 cursor-pointer"
              >
                <span>View telemetry logs</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

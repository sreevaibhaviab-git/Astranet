import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUpRight, Calendar, UserCheck, Layers } from "lucide-react";
import { Project } from "./SelectedWorks";

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
}

export default function ProjectModal({ project, onClose }: ProjectModalProps) {
  if (!project) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-surface border border-stroke rounded-3xl overflow-hidden flex flex-col shadow-2xl shadow-black"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between p-6 border-b border-stroke/70 bg-bg/50">
            <div>
              <span className="text-xs text-muted uppercase tracking-[0.2em] font-medium block">
                {project.category}
              </span>
              <h2 className="text-2xl sm:text-3xl font-display italic text-text-primary">
                {project.title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 rounded-full border border-stroke hover:bg-stroke/50 text-muted hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Scrollable Body */}
          <div className="overflow-y-auto p-6 sm:p-8 space-y-8">
            {/* High-res Image Preview */}
            <div className="rounded-2xl overflow-hidden border border-stroke/80 bg-black/40 aspect-[16/9] relative group">
              <img
                src={project.image}
                alt={project.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 halftone-overlay opacity-20 pointer-events-none" />
            </div>

            {/* Project Meta Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5 rounded-2xl bg-bg/60 border border-stroke">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-muted" />
                <div>
                  <div className="text-[11px] text-muted uppercase tracking-wider">
                    Timeline
                  </div>
                  <div className="text-sm font-medium text-text-primary font-mono">
                    {project.year}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <UserCheck className="w-4 h-4 text-muted" />
                <div>
                  <div className="text-[11px] text-muted uppercase tracking-wider">
                    Role
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {project.role}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 text-muted" />
                <div>
                  <div className="text-[11px] text-muted uppercase tracking-wider">
                    Domain
                  </div>
                  <div className="text-sm font-medium text-text-primary">
                    {project.category}
                  </div>
                </div>
              </div>
            </div>

            {/* Description & Narrative */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted font-medium mb-3">
                Overview & Architecture
              </h3>
              <p className="text-sm sm:text-base text-text-primary/90 leading-relaxed font-light">
                {project.description}
              </p>
            </div>

            {/* Tags */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted font-medium mb-3">
                Subsystems & Technologies
              </h3>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-3 py-1.5 rounded-lg bg-bg border border-stroke text-muted font-mono"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-stroke/70">
              <a
                href="#contact"
                onClick={onClose}
                className="text-xs text-muted hover:text-white underline underline-offset-4"
              >
                Inquire about this capability
              </a>

              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full accent-gradient text-white text-xs font-medium uppercase tracking-wider hover:opacity-90 transition-opacity"
              >
                <span>Close Preview</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

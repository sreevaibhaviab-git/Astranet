import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Calendar, Bookmark, Share2 } from "lucide-react";
import { JournalArticle } from "./Journal";
import { useState } from "react";

interface ArticleModalProps {
  article: JournalArticle | null;
  onClose: () => void;
}

export default function ArticleModal({ article, onClose }: ArticleModalProps) {
  const [bookmarked, setBookmarked] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!article) return null;

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
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
          {/* Header Bar */}
          <div className="flex items-center justify-between p-6 border-b border-stroke/70 bg-bg/50">
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>{article.category}</span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5" />
                {article.readTime}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="w-3.5 h-3.5" />
                {article.date}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBookmarked(!bookmarked)}
                className={`p-2 rounded-full border border-stroke transition-colors cursor-pointer ${
                  bookmarked ? "text-amber-400 border-amber-400/40" : "text-muted hover:text-white"
                }`}
                title="Bookmark article"
              >
                <Bookmark className="w-4 h-4" />
              </button>
              <button
                onClick={handleShare}
                className="p-2 rounded-full border border-stroke text-muted hover:text-white transition-colors cursor-pointer"
                title="Share link"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-full border border-stroke hover:bg-stroke/50 text-muted hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Article Content */}
          <div className="overflow-y-auto p-6 sm:p-10 space-y-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display italic text-text-primary leading-tight">
              {article.title}
            </h1>

            <p className="text-base sm:text-lg text-[#89AACC] font-light leading-relaxed border-l-2 border-[#4E85BF] pl-4">
              {article.excerpt}
            </p>

            <div className="w-full h-48 sm:h-64 rounded-2xl overflow-hidden border border-stroke relative my-6">
              <img
                src={article.thumbnail}
                alt={article.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
            </div>

            <div className="space-y-4 text-sm sm:text-base text-text-primary/90 font-light leading-relaxed">
              {article.content.map((paragraph, idx) => (
                <p key={idx}>{paragraph}</p>
              ))}

              <p>
                Autonomous self-healing coordination guarantees orbital swarm continuity
                even under severe communication degradation and sensor failure, ensuring
                mission objectives are sustained without ground intervention.
              </p>
            </div>

            {copiedLink && (
              <div className="text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 p-2.5 rounded-xl text-center">
                Link copied to clipboard!
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

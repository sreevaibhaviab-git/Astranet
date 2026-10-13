import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { gsap } from "gsap";
import { ArrowUpRight, Copy, Check, ChevronUp } from "lucide-react";

const HLS_URL =
  "https://stream.mux.com/Aa02T7oM1wH5Mk5EEVDYhbZ1ChcdhRsS2m1NYyx4Ua1g.m3u8";

const SOCIAL_LINKS = [
  { name: "SYSTEM", url: "#work" },
  { name: "SIMULATION", url: "#explorations" },
  { name: "MISSION", url: "#journal" },
  { name: "TEAM", url: "#contact" },
];

const MARQUEE_TEXT = "AUTONOMY • RESILIENCE • RECOVERY • ";
const REPEATED_MARQUEE = Array(10).fill(MARQUEE_TEXT).join("");

interface ContactFooterProps {
  onScrollToTop: () => void;
}

export default function ContactFooter({ onScrollToTop }: ContactFooterProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // HLS Video Initialization for footer (flipped vertically)
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({
        autoStartLoad: true,
        startLevel: -1,
        capLevelToPlayerSize: true,
      });
      hls.loadSource(HLS_URL);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = HLS_URL;
      video.addEventListener("loadedmetadata", () => {
        video.play().catch(() => {});
      });
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, []);

  // GSAP Marquee Animation
  useEffect(() => {
    const marquee = marqueeRef.current;
    if (!marquee) return;

    const anim = gsap.to(marquee, {
      xPercent: -50,
      duration: 40,
      ease: "none",
      repeat: -1,
    });

    return () => {
      anim.kill();
    };
  }, []);

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard.writeText("contact@astranet.space");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <footer
      id="contact"
      className="relative bg-bg pt-16 md:pt-20 pb-8 md:pb-12 overflow-hidden border-t border-stroke/40"
    >
      {/* Background Video flipped vertically (scale-y-[-1]) with heavier overlay */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          className="absolute top-1/2 left-1/2 min-w-full min-h-full object-cover -translate-x-1/2 -translate-y-1/2 scale-y-[-1] opacity-50"
        />
        {/* Heavier overlay: bg-black/60 */}
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-bg to-transparent" />
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16 flex flex-col items-center">
        {/* Marquee Header */}
        <div className="w-full overflow-hidden whitespace-nowrap mb-12 select-none border-y border-stroke/50 py-3">
          <div ref={marqueeRef} className="inline-block text-xs sm:text-sm text-muted/80 tracking-[0.3em] uppercase font-mono">
            <span>{REPEATED_MARQUEE}</span>
            <span>{REPEATED_MARQUEE}</span>
          </div>
        </div>

        {/* Big Contact Prompt */}
        <div className="text-center max-w-2xl mx-auto my-8 md:my-12">
          <span className="text-xs text-muted uppercase tracking-[0.3em] font-medium block mb-4">
            MISSION CONTROL
          </span>
          <h2 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display italic text-text-primary tracking-tight leading-[0.95] mb-6">
            Autonomous Swarm{" "}
            <span className="text-white underline decoration-[#4E85BF]/40 underline-offset-8">
              Resilience
            </span>
            .
          </h2>
          <p className="text-sm md:text-base text-muted max-w-md mx-auto mb-10 leading-relaxed">
            Decentralized self-healing coordination for survivable CubeSat constellations in low Earth orbit.
          </p>

          {/* Email Button with gradient hover border ring */}
          <div className="inline-flex flex-col sm:flex-row items-center gap-3">
            <a
              href="mailto:contact@astranet.space"
              className="group relative inline-flex items-center gap-3 rounded-full text-base sm:text-lg font-medium px-8 py-4 cursor-pointer overflow-hidden border border-stroke bg-surface hover:border-transparent transition-all duration-300"
            >
              {/* Gradient border ring on hover */}
              <span
                className="absolute -inset-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 accent-gradient -z-10"
                aria-hidden="true"
              />
              <span className="relative z-10 flex items-center gap-3 text-text-primary">
                <span>ENTER MISSION CONTROL</span>
                <ArrowUpRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1" />
              </span>
            </a>

            {/* Quick copy email tool */}
            <button
              onClick={handleCopyEmail}
              className="p-3.5 rounded-full border border-stroke bg-surface text-muted hover:text-white hover:border-white/20 transition-all duration-300 cursor-pointer"
              title="Copy contact to clipboard"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Footer Bar */}
        <div className="w-full mt-16 md:mt-24 pt-8 border-t border-stroke/60 flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-muted">
          {/* Green pulsing dot + "SYSTEM STATUS • ONLINE" */}
          <div className="flex items-center gap-2.5 order-2 md:order-1">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="font-medium text-text-primary tracking-wide">
              SYSTEM STATUS • ONLINE
            </span>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-6 order-1 md:order-2">
            {SOCIAL_LINKS.map((link) => (
              <a
                key={link.name}
                href={link.url}
                className="hover:text-text-primary transition-colors hover:underline underline-offset-4"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Footer Identity & Scroll to Top */}
          <div className="flex items-center gap-4 order-3">
            <div className="text-right">
              <div className="font-semibold text-text-primary tracking-wider">ASTRANET</div>
              <div className="text-[11px] text-muted">Autonomous Self-Healing CubeSat Swarm</div>
              <div className="text-[10px] text-muted/80 font-mono">Ctrl Freaks • 2026</div>
            </div>
            <button
              onClick={onScrollToTop}
              className="p-2 rounded-full border border-stroke bg-surface/50 hover:bg-surface text-muted hover:text-white transition-colors cursor-pointer shrink-0"
              title="Scroll back to top"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}

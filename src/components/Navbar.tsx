import { useState, useEffect } from "react";
import { ArrowUpRight } from "lucide-react";

interface NavbarProps {
  activeSection: string;
  onNavigate: (sectionId: string) => void;
  onOpenResume: () => void;
  onOpenContact: () => void;
}

export default function Navbar({
  activeSection,
  onNavigate,
  onOpenResume,
  onOpenContact,
}: NavbarProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setHasScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 md:pt-6 px-4 pointer-events-none">
      <div
        className={`pointer-events-auto inline-flex items-center rounded-full backdrop-blur-md border border-white/10 bg-surface/90 px-2 py-1.5 sm:py-2 transition-all duration-300 ${
          hasScrolled ? "shadow-md shadow-black/40 border-white/20" : ""
        }`}
      >
        {/* 1. Logo */}
        <button
          onClick={() => onNavigate("home")}
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
          className="group relative w-9 h-9 rounded-full flex items-center justify-center p-[1.5px] transition-transform duration-300 hover:scale-110 cursor-pointer shrink-0"
          title="ASTRANET"
        >
          {/* Animated gradient ring border */}
          <div
            className={`absolute inset-0 rounded-full transition-all duration-500 ${
              logoHovered
                ? "bg-[linear-gradient(270deg,#89AACC_0%,#4E85BF_100%)] rotate-180"
                : "accent-gradient"
            }`}
          />
          {/* Inner circle */}
          <div className="relative w-full h-full bg-bg rounded-full flex items-center justify-center">
            <span className="font-display italic text-[13px] text-text-primary tracking-tighter">
              AN
            </span>
          </div>
        </button>

        {/* 2. Divider (hidden on mobile) */}
        <div className="hidden sm:block w-px h-5 bg-stroke mx-1 shrink-0" />

        {/* 3. Nav links */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onNavigate("home")}
            className={`text-xs sm:text-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 transition-colors cursor-pointer font-medium ${
              activeSection === "home"
                ? "text-text-primary bg-stroke/50"
                : "text-muted hover:text-text-primary hover:bg-stroke/50"
            }`}
          >
            Home
          </button>

          <button
            onClick={() => onNavigate("work")}
            className={`text-xs sm:text-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 transition-colors cursor-pointer font-medium ${
              activeSection === "work"
                ? "text-text-primary bg-stroke/50"
                : "text-muted hover:text-text-primary hover:bg-stroke/50"
            }`}
          >
            System
          </button>

          <button
            onClick={onOpenResume}
            className={`text-xs sm:text-sm rounded-full px-3 sm:px-4 py-1.5 sm:py-2 transition-colors cursor-pointer font-medium ${
              activeSection === "resume"
                ? "text-text-primary bg-stroke/50"
                : "text-muted hover:text-text-primary hover:bg-stroke/50"
            }`}
          >
            Mission
          </button>
        </div>

        {/* 4. Divider */}
        <div className="w-px h-5 bg-stroke mx-1 shrink-0" />

        {/* 5. "Enter System" button with hover gradient border behind */}
        <button
          onClick={onOpenContact}
          className="relative group text-xs sm:text-sm rounded-full cursor-pointer overflow-visible shrink-0"
        >
          {/* Gradient glow behind on hover */}
          <span
            className="absolute -inset-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 accent-gradient -z-10"
            aria-hidden="true"
          />
          {/* Inner content pill */}
          <span className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-surface border border-transparent group-hover:border-transparent text-text-primary font-medium transition-colors">
            <span>Enter System</span>
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </span>
        </button>
      </div>
    </nav>
  );
}

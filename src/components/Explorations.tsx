import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowUpRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

export interface ExplorationItem {
  id: string;
  title: string;
  category: string;
  rotation: string;
  image: string;
  color: string;
  technique: string;
}

export const EXPLORATION_ITEMS: ExplorationItem[] = [
  {
    id: "exp-1",
    title: "Node Loss",
    category: "Orbital Fault 01",
    rotation: "-rotate-3",
    image: "/src/assets/images/scenario_node_loss.jpg",
    color: "#4E85BF",
    technique: "Decentralized Node Drop Detection",
  },
  {
    id: "exp-2",
    title: "Communication Failure",
    category: "Orbital Fault 02",
    rotation: "rotate-4",
    image: "/src/assets/images/scenario_comm_failure.jpg",
    color: "#89AACC",
    technique: "ISL Blackout & Cross-Link Rerouting",
  },
  {
    id: "exp-3",
    title: "Thruster Failure",
    category: "Orbital Fault 03",
    rotation: "-rotate-2",
    image: "/src/assets/images/scenario_thruster_failure.jpg",
    color: "#6C92BF",
    technique: "Underactuated Formation Control",
  },
  {
    id: "exp-4",
    title: "Low Energy",
    category: "Orbital Fault 04",
    rotation: "rotate-3",
    image: "/src/assets/images/scenario_low_energy.jpg",
    color: "#A2C2E2",
    technique: "Eclipse Mode Subsystem Shedding",
  },
  {
    id: "exp-5",
    title: "Network Partition",
    category: "Orbital Fault 05",
    rotation: "-rotate-4",
    image: "/src/assets/images/scenario_network_partition.jpg",
    color: "#4E85BF",
    technique: "Byzantine Sub-Swarm Federation",
  },
  {
    id: "exp-6",
    title: "Cascading Failure",
    category: "Orbital Fault 06",
    rotation: "rotate-2",
    image: "/src/assets/images/scenario_cascading_failure.jpg",
    color: "#89AACC",
    technique: "Multi-Node Correlated Fault Isolation",
  },
];

interface ExplorationsProps {
  onSelectItem: (item: ExplorationItem) => void;
  onOpenDribbble: () => void;
}

export default function Explorations({
  onSelectItem,
  onOpenDribbble,
}: ExplorationsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const centerPinnedRef = useRef<HTMLDivElement>(null);
  const col1Ref = useRef<HTMLDivElement>(null);
  const col2Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const centerPinned = centerPinnedRef.current;
    const col1 = col1Ref.current;
    const col2 = col2Ref.current;

    if (!container || !centerPinned || !col1 || !col2) return;

    const ctx = gsap.context(() => {
      // Pin center content during scroll
      ScrollTrigger.create({
        trigger: container,
        start: "top top",
        end: "bottom bottom",
        pin: centerPinned,
        pinSpacing: false,
      });

      // Parallax movement on Column 1
      gsap.to(col1, {
        y: -350,
        ease: "none",
        scrollTrigger: {
          trigger: container,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.2,
        },
      });

      // Parallax movement on Column 2 (faster/offset)
      gsap.to(col2, {
        y: -580,
        ease: "none",
        scrollTrigger: {
          trigger: container,
          start: "top bottom",
          end: "bottom top",
          scrub: 1.8,
        },
      });
    }, container);

    return () => ctx.revert();
  }, []);

  const col1Items = EXPLORATION_ITEMS.filter((_, i) => i % 2 === 0);
  const col2Items = EXPLORATION_ITEMS.filter((_, i) => i % 2 !== 0);

  return (
    <section
      id="explorations"
      ref={containerRef}
      className="relative min-h-[300vh] bg-bg overflow-hidden"
    >
      {/* Layer 1: Pinned Center (z-10) */}
      <div
        ref={centerPinnedRef}
        className="h-screen w-full flex items-center justify-center pointer-events-none z-10"
      >
        <div className="text-center px-6 max-w-xl pointer-events-auto select-none">
          {/* Eyebrow */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="w-8 h-px bg-stroke block" />
            <span className="text-xs text-muted uppercase tracking-[0.3em] font-medium">
              Simulation
            </span>
            <span className="w-8 h-px bg-stroke block" />
          </div>

          {/* Heading */}
          <h2 className="text-5xl sm:text-6xl md:text-7xl font-light text-text-primary tracking-tight mb-4">
            Failure{" "}
            <span className="font-display italic text-6xl sm:text-7xl md:text-8xl text-white font-normal">
              Scenarios
            </span>
          </h2>

          {/* Subtext */}
          <p className="text-sm md:text-base text-muted mb-8 leading-relaxed">
            High-fidelity dynamic simulations stress-testing autonomous swarm resilience across orbital edge cases.
          </p>

          {/* Button */}
          <button
            onClick={onOpenDribbble}
            className="group relative inline-flex items-center gap-2 rounded-full text-xs uppercase tracking-wider font-medium px-6 py-3 cursor-pointer overflow-hidden border border-stroke bg-surface hover:border-transparent transition-all duration-300"
          >
            <span
              className="absolute -inset-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 accent-gradient -z-10"
              aria-hidden="true"
            />
            <span className="relative z-10 flex items-center gap-2 text-text-primary">
              <span>Explore Scenarios</span>
              <ArrowUpRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </span>
          </button>
        </div>
      </div>

      {/* Layer 2: Parallax Columns (z-20, absolute overlay) */}
      <div className="absolute inset-0 pointer-events-none z-20 flex justify-center px-6">
        <div className="w-full max-w-[1400px] grid grid-cols-2 gap-8 md:gap-40 pt-48 pb-32">
          {/* Column 1 */}
          <div ref={col1Ref} className="flex flex-col gap-28 md:gap-40 items-start">
            {col1Items.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`pointer-events-auto group relative aspect-square w-full max-w-[280px] sm:max-w-[320px] rounded-3xl bg-surface border border-stroke p-3 cursor-pointer transition-all duration-500 hover:scale-105 hover:border-white/30 shadow-2xl shadow-black/80 ${item.rotation}`}
              >
                <div className="w-full h-full rounded-2xl overflow-hidden relative">
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* Item info */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[10px] text-muted tracking-widest uppercase block mb-1">
                      {item.category}
                    </span>
                    <span className="text-sm sm:text-base font-display italic text-white block">
                      {item.title}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Column 2 */}
          <div ref={col2Ref} className="flex flex-col gap-28 md:gap-40 items-end pt-36">
            {col2Items.map((item) => (
              <div
                key={item.id}
                onClick={() => onSelectItem(item)}
                className={`pointer-events-auto group relative aspect-square w-full max-w-[280px] sm:max-w-[320px] rounded-3xl bg-surface border border-stroke p-3 cursor-pointer transition-all duration-500 hover:scale-105 hover:border-white/30 shadow-2xl shadow-black/80 ${item.rotation}`}
              >
                <div className="w-full h-full rounded-2xl overflow-hidden relative">
                  <img
                    src={item.image}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* Item info */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-[10px] text-muted tracking-widest uppercase block mb-1">
                      {item.category}
                    </span>
                    <span className="text-sm sm:text-base font-display italic text-white block">
                      {item.title}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

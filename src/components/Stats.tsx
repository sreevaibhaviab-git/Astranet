import { motion } from "framer-motion";

interface StatItem {
  value: string;
  label: string;
  subtext: string;
}

const STATS: StatItem[] = [
  {
    value: "PROBLEM",
    label: "Satellite Failure Disrupts the Swarm",
    subtext:
      "A single spacecraft failure can break communication links, reduce mission coverage and disrupt coordinated constellation operations.",
  },
  {
    value: "1000+",
    label: "CubeSats Launched in Recent Years",
    subtext:
      "CubeSat constellations are rapidly increasing, while small satellites remain exposed to communication, propulsion, navigation and environmental failures.",
  },
  {
    value: "ASTRANET",
    label: "Autonomous Self-Healing Recovery",
    subtext:
      "ASTRANET detects failures, verifies them through peer consensus, reallocates roles and reconfigures the surviving swarm to preserve mission capability.",
  },
];

export default function Stats() {
  return (
    <section className="bg-bg py-16 md:py-24 border-y border-stroke relative z-20">
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 lg:px-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8 lg:gap-12">
          {STATS.map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.8,
                delay: idx * 0.15,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="flex flex-col items-center md:items-start text-center md:text-left group"
            >
              {/* Stat Value */}
              <div className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display italic text-text-primary tabular-nums tracking-tight mb-2 group-hover:text-white transition-colors">
                {stat.value}
              </div>

              {/* Stat Label */}
              <div className="text-base sm:text-lg font-medium text-text-primary mb-2">
                {stat.label}
              </div>

              {/* Subtext */}
              <p className="text-xs sm:text-sm text-muted max-w-xs leading-relaxed">
                {stat.subtext}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

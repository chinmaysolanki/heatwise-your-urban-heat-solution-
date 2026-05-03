import { motion } from "framer-motion";
import { AnimatedSection, fadeUp } from "./AnimatedSection";
import { SectionLabel } from "./SectionLabel";
import { GreenButton } from "./GreenButton";

const species = [
  { emoji: "🌿", name: "Tulsi", sci: "Ocimum sanctum", score: 78, tags: ["Pet Safe", "Native"] },
  { emoji: "🪴", name: "Snake Plant", sci: "Sansevieria", score: 92, tags: ["Drought OK", "Indoor"] },
  { emoji: "🌱", name: "Curry Leaf", sci: "Murraya koenigii", score: 85, tags: ["Edible", "Native"] },
  { emoji: "🌾", name: "Lemongrass", sci: "Cymbopogon", score: 81, tags: ["Drought OK", "Repels bugs"] },
  { emoji: "🍃", name: "Money Plant", sci: "Epipremnum aureum", score: 88, tags: ["Indoor", "Easy"] },
  { emoji: "🌳", name: "Neem", sci: "Azadirachta indica", score: 96, tags: ["Native", "Shade"] },
  { emoji: "🌵", name: "Aloe Vera", sci: "Aloe barbadensis", score: 73, tags: ["Drought OK", "Medicinal"] },
  { emoji: "🌻", name: "Marigold", sci: "Tagetes", score: 65, tags: ["Pollinator", "Pet Safe"] },
];

export function Species() {
  return (
    <AnimatedSection className="relative py-24 md:py-32 overflow-hidden bg-white/40">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div variants={fadeUp} className="text-center max-w-3xl mx-auto">
          <SectionLabel className="mx-auto justify-center">05 — Species</SectionLabel>
          <h2 className="mt-4 font-display font-bold text-4xl md:text-6xl text-forest">
            800+ plants. <span className="text-gradient-green">One perfect match.</span>
          </h2>
          <p className="mt-4 text-forest/60 text-lg">
            Every species rated for cooling power, drought tolerance, pet safety, and regional fit.
          </p>
        </motion.div>
      </div>

      <motion.div variants={fadeUp} className="mt-14 overflow-hidden">
        <motion.div
          className="flex gap-5 px-6"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          {[...species, ...species].map((s, i) => (
            <div
              key={i}
              className="shrink-0 w-72 bg-white border border-forest/10 shadow-[var(--shadow-card)] rounded-2xl p-6 hover:border-green/40 hover:shadow-[var(--shadow-card-hover)] transition"
            >
              <div className="text-6xl">{s.emoji}</div>
              <h3 className="mt-4 font-display text-xl font-semibold text-forest">{s.name}</h3>
              <p className="font-mono text-xs text-forest/45 italic">{s.sci}</p>

              <div className="mt-4">
                <div className="flex justify-between text-xs font-mono text-forest/55 mb-1.5">
                  <span>COOLING SCORE</span>
                  <span className="text-green font-bold">{s.score}</span>
                </div>
                <div className="h-1.5 rounded-full bg-forest/8 overflow-hidden">
                  <div
                    className="h-full bg-[var(--gradient-green)]"
                    style={{ width: `${s.score}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {s.tags.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-mint/50 text-forest/70 border border-forest/8"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <div className="mt-14 text-center">
        <GreenButton variant="ghost">Browse Full Catalog →</GreenButton>
      </div>
    </AnimatedSection>
  );
}

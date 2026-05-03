import { motion } from "framer-motion";
import { AnimatedSection, fadeUp } from "./AnimatedSection";
import { SectionLabel } from "./SectionLabel";
import { Star } from "lucide-react";

const items = [
  {
    quote: "Our terrace went from 44°C to 36°C in two months. The kids actually use it now in May.",
    name: "Aanya Mehta", city: "Mumbai · Bandra", initials: "AM",
  },
  {
    quote: "The AI plan picked native species I'd never have considered. Maintenance is almost zero.",
    name: "Ravi Krishnan", city: "Bengaluru · Indiranagar", initials: "RK",
  },
  {
    quote: "Our society's electricity bill dropped 18% after greening four rooftops. Pays for itself.",
    name: "Priya Shah", city: "Pune · Kothrud", initials: "PS",
  },
];

export function Testimonials() {
  return (
    <AnimatedSection className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto">
          <SectionLabel className="mx-auto justify-center">06 — Voices</SectionLabel>
          <h2 className="mt-4 font-display font-bold text-4xl md:text-6xl text-forest">
            Cooler homes, <span className="text-gradient-green">happier people</span>
          </h2>
        </motion.div>

        <div className="mt-14 grid md:grid-cols-3 gap-5">
          {items.map((t, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              whileHover={{ y: -6 }}
              className="relative rounded-2xl bg-white border border-forest/10 shadow-[var(--shadow-card)] p-7 border-l-2 border-l-green"
            >
              <div className="flex gap-1 text-gold">
                {Array.from({ length: 5 }).map((_, k) => (
                  <Star key={k} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 text-forest/85 text-lg leading-relaxed font-display">
                "{t.quote}"
              </p>
              <div className="mt-6 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-[var(--gradient-green)] text-white font-bold text-sm">
                  {t.initials}
                </div>
                <div>
                  <div className="font-medium text-forest">{t.name}</div>
                  <div className="text-xs text-forest/50 font-mono">{t.city}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

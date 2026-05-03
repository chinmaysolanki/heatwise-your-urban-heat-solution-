import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedSection, fadeUp } from "./AnimatedSection";
import { SectionLabel } from "./SectionLabel";
import { Plus } from "lucide-react";

const faqs = [
  {
    q: "How accurate is the AR scan?",
    a: "Our computer vision is accurate to ±5cm on most modern phones (2020+). For larger spaces, you can scan in segments and we'll stitch the layout automatically.",
  },
  {
    q: "What if my plants die?",
    a: "Every Green and Pro plan includes a 90-day plant guarantee. If a recommended species fails to establish under our care guide, we replace it free.",
  },
  {
    q: "How does the AI pick species for me?",
    a: "It cross-references your live climate (temperature, UV, humidity, wind from Open-Meteo) with structural load, sun hours, your maintenance preference, and pet/child safety needs against our 800+ species database.",
  },
  {
    q: "Do you deliver plants?",
    a: "We partner with verified local nurseries in 14 cities. Plants ship within 48 hours and come ready to install with care instructions.",
  },
  {
    q: "Can installers do everything?",
    a: "Yes. Our installer network handles waterproofing, drainage, planters, soil, and the planting itself. Fixed-price quotes, insured work, 12-month warranty.",
  },
  {
    q: "What's the actual cooling impact?",
    a: "Average is −4.2°C surface temperature on a fully greened rooftop, with a 6–18% reduction in AC use for the floor below. Results depend on coverage % and species mix.",
  },
  {
    q: "Is there a refund policy?",
    a: "Software subscriptions are refundable within 30 days, no questions. Installation work is covered by our 12-month warranty.",
  },
  {
    q: "Do you work with housing societies?",
    a: "Yes. Our Pro tier includes multi-space management, society-wide analytics, and a dedicated advisor for committee approvals.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <AnimatedSection className="relative py-24 md:py-32 bg-white/40">
      <div className="mx-auto max-w-4xl px-6">
        <motion.div variants={fadeUp} className="text-center">
          <SectionLabel className="mx-auto justify-center">09 — FAQ</SectionLabel>
          <h2 className="mt-4 font-display font-bold text-4xl md:text-5xl text-forest">
            Questions, <span className="text-gradient-green">answered</span>
          </h2>
        </motion.div>

        <div className="mt-12 space-y-3">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <motion.div key={i} variants={fadeUp} className="bg-white border border-forest/10 shadow-sm rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-5 text-left"
                >
                  <span className="font-display text-lg font-medium text-forest">{f.q}</span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-green/15 text-green"
                  >
                    <Plus className="h-4 w-4" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <p className="px-5 pb-5 text-forest/65 leading-relaxed">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AnimatedSection>
  );
}

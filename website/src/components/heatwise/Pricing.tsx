import { useState } from "react";
import { motion } from "framer-motion";
import { AnimatedSection, fadeUp } from "./AnimatedSection";
import { SectionLabel } from "./SectionLabel";
import { GreenButton } from "./GreenButton";
import { Check } from "lucide-react";

type Tier = {
  emoji: string;
  name: string;
  monthly: number;
  annual: number;
  tagline: string;
  perks: string[];
  popular?: boolean;
};

const tiers: Tier[] = [
  {
    emoji: "🌱",
    name: "Starter",
    monthly: 0,
    annual: 0,
    tagline: "Try the magic, free forever.",
    perks: ["1 scan per month", "Basic AI plan", "Species recommendations", "Email support"],
  },
  {
    emoji: "🌿",
    name: "Green",
    monthly: 499,
    annual: 399,
    tagline: "For homes serious about cooling.",
    popular: true,
    perks: [
      "Unlimited scans",
      "Full AI layout engine",
      "Cooling impact analytics",
      "Installer connect",
      "Priority support",
    ],
  },
  {
    emoji: "🌳",
    name: "Pro / Society",
    monthly: 2499,
    annual: 1999,
    tagline: "Multi-space management for buildings.",
    perks: [
      "Everything in Green",
      "Multi-space management",
      "Analytics dashboard",
      "Dedicated advisor",
      "API access",
    ],
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <AnimatedSection className="relative py-24 md:py-32" id="pricing">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto">
          <SectionLabel className="mx-auto justify-center">08 — Pricing</SectionLabel>
          <h2 className="mt-4 font-display font-bold text-4xl md:text-6xl text-forest">
            Plant a plan that <span className="text-gradient-green">grows with you</span>
          </h2>

          <div className="mt-8 inline-flex items-center gap-1 bg-white border border-forest/10 shadow-sm rounded-full p-1">
            {(["Monthly", "Annual · -20%"] as const).map((label, i) => (
              <button
                key={label}
                onClick={() => setAnnual(i === 1)}
                className={`relative px-5 py-2 rounded-full text-sm font-medium transition ${
                  (i === 1) === annual ? "text-white" : "text-forest/60"
                }`}
              >
                {(i === 1) === annual && (
                  <motion.span
                    layoutId="pricingPill"
                    className="absolute inset-0 rounded-full bg-[var(--gradient-green)]"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        <div className="mt-14 grid md:grid-cols-3 gap-6">
          {tiers.map((t) => (
            <motion.div
              key={t.name}
              variants={fadeUp}
              whileHover={{ y: -8 }}
              className={`relative rounded-3xl p-8 transition-shadow ${
                t.popular
                  ? "bg-white ring-2 ring-green shadow-[var(--shadow-glow-strong)]"
                  : "bg-white border border-forest/10 shadow-[var(--shadow-card)]"
              }`}
            >
              {t.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-mono bg-[var(--gradient-green)] text-white font-bold tracking-wider uppercase">
                  Most Popular
                </div>
              )}
              <div className="text-4xl">{t.emoji}</div>
              <h3 className="mt-3 font-display text-2xl font-bold text-forest">{t.name}</h3>
              <p className="text-forest/55 text-sm mt-1">{t.tagline}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <motion.span
                  key={`${t.name}-${annual}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="font-display text-5xl font-bold text-forest"
                >
                  {t.monthly === 0 ? "Free" : `₹${annual ? t.annual : t.monthly}`}
                </motion.span>
                {t.monthly !== 0 && (
                  <span className="text-forest/50 text-sm">/mo</span>
                )}
              </div>

              <GreenButton
                variant={t.popular ? "primary" : "ghost"}
                className="w-full mt-6"
              >
                {t.monthly === 0 ? "Start free →" : "Get started →"}
              </GreenButton>

              <ul className="mt-7 space-y-3">
                {t.perks.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-forest/75">
                    <span className="grid h-5 w-5 shrink-0 mt-0.5 place-items-center rounded-full bg-green/15 text-green">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

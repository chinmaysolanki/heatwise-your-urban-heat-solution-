import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/heatwise/Navbar";
import { Footer } from "@/components/heatwise/Footer";
import { HowItWorks } from "@/components/heatwise/HowItWorks";
import { FAQ } from "@/components/heatwise/FAQ";
import { FinalCTA } from "@/components/heatwise/FinalCTA";
import { AnimatedSection, fadeUp } from "@/components/heatwise/AnimatedSection";
import { SectionLabel } from "@/components/heatwise/SectionLabel";
import { GlassCard } from "@/components/heatwise/GlassCard";
import { motion } from "framer-motion";
import { Play } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  component: Page,
  head: () => ({
    meta: [
      { title: "How HeatWise Works — From Scan to Cooling Canopy" },
      { name: "description", content: "AR scanning, live climate detection, and an AI species engine. Here's exactly how HeatWise turns your space into a cooling green canopy." },
    ],
  }),
});

function Page() {
  return (
    <main>
      <Navbar />
      <section className="pt-40 pb-12 text-center px-6">
        <SectionLabel className="mx-auto justify-center">The Process</SectionLabel>
        <h1 className="mt-4 font-display font-bold text-5xl md:text-7xl max-w-4xl mx-auto text-forest">
          How HeatWise <span className="text-gradient-green">cools your space</span>
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-forest/65 text-lg">
          Computer vision, live climate APIs and a species-matching engine — together in one tap.
        </p>
      </section>

      {/* Demo video placeholder */}
      <AnimatedSection className="py-12">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div
            variants={fadeUp}
            className="relative aspect-video rounded-3xl overflow-hidden grid place-items-center group cursor-pointer border border-forest/10 shadow-[var(--shadow-card)]"
            style={{ background: "linear-gradient(135deg, oklch(0.30 0.06 155), oklch(0.20 0.04 155))" }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,oklch(0.65_0.16_152/0.4),transparent_70%)]" />
            <div className="absolute inset-0 grain" />
            <div className="relative z-10 grid h-20 w-20 place-items-center rounded-full bg-[var(--gradient-green)] text-white shadow-[var(--shadow-glow-strong)] group-hover:scale-110 transition">
              <Play className="h-8 w-8 fill-current" />
            </div>
            <div className="absolute bottom-6 left-6 font-mono text-xs text-white/65">DEMO · 90s · WATCH HOW IT WORKS</div>
          </motion.div>
        </div>
      </AnimatedSection>

      <HowItWorks />

      {/* Climate API explainer */}
      <AnimatedSection className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div variants={fadeUp} className="max-w-2xl">
            <SectionLabel>Climate Detection</SectionLabel>
            <h2 className="mt-4 font-display font-bold text-4xl md:text-5xl text-forest">
              Live data, not <span className="text-gradient-green">averages</span>
            </h2>
            <p className="mt-4 text-forest/60 text-lg">
              We pull 9 datapoints from Open-Meteo every 15 minutes for your exact GPS coordinates.
            </p>
          </motion.div>

          <div className="mt-12 grid md:grid-cols-3 gap-4">
            {[
              { k: "Temperature", v: "Surface + air, hourly forecast" },
              { k: "UV Index", v: "Real-time, factors species sun tolerance" },
              { k: "Humidity", v: "Affects watering schedule + species choice" },
              { k: "Wind", v: "Structural load + drying impact on soil" },
              { k: "Rainfall", v: "12-month historical + 7-day forecast" },
              { k: "Cloud Cover", v: "Effective sun hours per planting cell" },
              { k: "Air Quality", v: "Picks pollution-tolerant species" },
              { k: "Sunrise/Set", v: "Light gradient mapping per square metre" },
              { k: "Soil Temp", v: "Root system suitability per species" },
            ].map((d) => (
              <motion.div key={d.k} variants={fadeUp}>
                <GlassCard>
                  <div className="font-mono text-xs uppercase tracking-widest text-green">{d.k}</div>
                  <div className="mt-2 text-forest/75">{d.v}</div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* Algorithm diagram */}
      <AnimatedSection className="py-24">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto">
            <SectionLabel className="mx-auto justify-center">The Engine</SectionLabel>
            <h2 className="mt-4 font-display font-bold text-4xl md:text-5xl text-forest">
              How the AI <span className="text-gradient-green">picks species</span>
            </h2>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-12 bg-white border border-forest/10 shadow-[var(--shadow-card)] rounded-3xl p-8">
            <div className="flex flex-col md:flex-row items-stretch gap-4">
              {[
                { t: "Inputs", items: ["Space dimensions", "Climate datapoints", "Sun map", "Preferences"] },
                { t: "Constraints", items: ["Pet/child safety", "Maintenance level", "Budget", "Native priority"] },
                { t: "Optimiser", items: ["Cooling score max", "Diversity score", "Water budget", "Layout pack"] },
                { t: "Output", items: ["Species mix", "Layout map", "−°C estimate", "Care guide"] },
              ].map((b, i) => (
                <div key={b.t} className="flex-1 min-w-0">
                  <div className="rounded-2xl bg-mint/30 border border-forest/8 p-5 h-full">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-green mb-1">Step {i + 1}</div>
                    <div className="font-display font-semibold text-lg mb-3 text-forest">{b.t}</div>
                    <ul className="space-y-1.5 text-sm text-forest/65">
                      {b.items.map((it) => <li key={it}>· {it}</li>)}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </AnimatedSection>

      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  );
}

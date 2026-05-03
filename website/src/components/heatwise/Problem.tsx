import { AnimatedSection, fadeUp } from "./AnimatedSection";
import { GlassCard } from "./GlassCard";
import { SectionLabel } from "./SectionLabel";
import { CountUp } from "./CountUp";
import { motion } from "framer-motion";
import { Thermometer, Plug, Building } from "lucide-react";

export function Problem() {
  return (
    <AnimatedSection className="relative py-24 md:py-32 overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_50%,oklch(0.70_0.18_45/0.10),transparent_55%)]" />

      <div className="mx-auto max-w-7xl px-6">
        <motion.div variants={fadeUp}>
          <SectionLabel>01 — The Problem</SectionLabel>
          <h2 className="mt-4 max-w-3xl font-display font-bold text-4xl md:text-6xl text-forest">
            The heat crisis <span className="text-gradient-heat">is real</span>.
          </h2>
          <p className="mt-4 max-w-2xl text-forest/60 text-lg">
            Urban heat islands push city temperatures up to 7°C above surrounding areas.
            Concrete absorbs, AC pumps it back out, and rooftops sit empty.
          </p>
        </motion.div>

        <div className="mt-16 grid lg:grid-cols-2 gap-10 items-center">
          {/* Heatmap visual — dark inset card for contrast */}
          <motion.div
            variants={fadeUp}
            className="relative aspect-square rounded-3xl overflow-hidden p-6 border border-forest/8 shadow-[var(--shadow-card)]"
            style={{
              background:
                "radial-gradient(circle at 30% 30%, oklch(0.62 0.22 25 / 0.95), transparent 30%), radial-gradient(circle at 70% 60%, oklch(0.70 0.18 45 / 0.9), transparent 32%), radial-gradient(circle at 50% 80%, oklch(0.62 0.22 25 / 0.75), transparent 26%), radial-gradient(circle at 85% 25%, oklch(0.65 0.16 152 / 0.55), transparent 22%), linear-gradient(180deg, oklch(0.20 0.04 155), oklch(0.27 0.05 155))",
            }}
          >
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "linear-gradient(oklch(1 0 0 / 0.08) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.08) 1px, transparent 1px)",
                backgroundSize: "32px 32px",
              }}
            />
            <div className="relative h-full flex flex-col justify-end text-white">
              <div className="font-mono text-xs text-white/65">LIVE · MUMBAI · SECTOR HEAT INDEX</div>
              <div className="mt-2 flex items-end justify-between font-display">
                <div>
                  <div className="text-5xl font-bold text-gradient-heat">42.7°C</div>
                  <div className="text-xs text-white/55 mt-1 font-mono">SURFACE TEMP — 14:32 IST</div>
                </div>
                <div className="flex gap-1.5">
                  {[0.4, 0.6, 0.8, 1, 0.9, 0.7].map((h, i) => (
                    <div
                      key={i}
                      className="w-2 rounded-full bg-heat-red"
                      style={{ height: `${h * 40}px`, opacity: 0.5 + h * 0.5 }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          <div className="grid gap-4">
            {[
              {
                icon: Thermometer,
                stat: <><CountUp to={5} suffix="°C" /></>,
                label: "City rooftops are hotter than nearby green areas",
              },
              {
                icon: Plug,
                stat: <><CountUp to={8} suffix="%" /></>,
                label: "AC electricity usage rises per °C of outdoor heat",
              },
              {
                icon: Building,
                stat: <><CountUp to={72} suffix="%" /></>,
                label: "of urban rooftops sit empty and unused",
              },
            ].map((s, i) => (
              <motion.div key={i} variants={fadeUp}>
                <GlassCard className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-heat-red/10 text-heat-red">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="font-display text-4xl font-bold text-gradient-heat">{s.stat}</div>
                    <p className="text-forest/65 mt-1">{s.label}</p>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

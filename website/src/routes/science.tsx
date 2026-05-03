import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/heatwise/Navbar";
import { Footer } from "@/components/heatwise/Footer";
import { FinalCTA } from "@/components/heatwise/FinalCTA";
import { SectionLabel } from "@/components/heatwise/SectionLabel";
import { AnimatedSection, fadeUp } from "@/components/heatwise/AnimatedSection";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";

export const Route = createFileRoute("/science")({
  component: Page,
  head: () => ({
    meta: [
      { title: "The Science — How Green Roofs Cool Cities" },
      { name: "description", content: "Peer-reviewed research on urban heat islands and how rooftop greening measurably reduces temperatures, AC load, and carbon footprint." },
    ],
  }),
});

const data = [
  { week: "W0", control: 42, greened: 42 },
  { week: "W2", control: 42.4, greened: 41.1 },
  { week: "W4", control: 43.1, greened: 39.6 },
  { week: "W6", control: 43.8, greened: 38.3 },
  { week: "W8", control: 44.2, greened: 37.6 },
  { week: "W10", control: 43.6, greened: 37.0 },
  { week: "W12", control: 43.1, greened: 36.4 },
];

function Page() {
  return (
    <main>
      <Navbar />
      <section className="pt-40 pb-12 text-center px-6">
        <SectionLabel className="mx-auto justify-center">The Science</SectionLabel>
        <h1 className="mt-4 font-display font-bold text-5xl md:text-7xl max-w-4xl mx-auto text-forest">
          The math behind <span className="text-gradient-green">cooler cities</span>
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-forest/65 text-lg">
          What actually happens when concrete becomes canopy. Peer-reviewed, real-world.
        </p>
      </section>

      {/* UHI explainer */}
      <AnimatedSection className="py-20">
        <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div variants={fadeUp}>
            <SectionLabel>Urban Heat Island</SectionLabel>
            <h2 className="mt-4 font-display font-bold text-4xl md:text-5xl">
              Why cities get <span className="text-gradient-heat">7°C hotter</span>
            </h2>
            <p className="mt-5 text-forest/65 text-lg leading-relaxed">
              Concrete and asphalt absorb up to 95% of solar radiation. They release it slowly through the night, keeping urban areas warm long after the countryside cools down. Add waste heat from AC units and traffic, and you get the urban heat island effect.
            </p>
            <p className="mt-4 text-forest/65 text-lg leading-relaxed">
              Plants reverse this through evapotranspiration — pulling water through roots and releasing it as vapour from leaves. The phase change cools surrounding air by 2–8°C.
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="relative aspect-square glass-strong rounded-3xl p-8 grid place-items-center">
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* Sun */}
              <circle cx="40" cy="40" r="14" fill="var(--gold)" />
              <g stroke="var(--gold)" strokeWidth="2" strokeLinecap="round">
                {Array.from({ length: 8 }).map((_, i) => {
                  const a = (i * Math.PI) / 4;
                  return (
                    <line key={i}
                      x1={40 + Math.cos(a) * 22}
                      y1={40 + Math.sin(a) * 22}
                      x2={40 + Math.cos(a) * 30}
                      y2={40 + Math.sin(a) * 30}
                    />
                  );
                })}
              </g>
              {/* Concrete building */}
              <rect x="100" y="80" width="60" height="100" fill="oklch(0.35 0.03 30)" />
              <text x="130" y="135" textAnchor="middle" fontSize="9" fill="white" opacity="0.7" fontFamily="monospace">CONCRETE</text>
              <text x="130" y="150" textAnchor="middle" fontSize="14" fill="var(--heat-red)" fontFamily="monospace" fontWeight="bold">+42°C</text>
              {/* Heat radiating */}
              <g stroke="var(--heat-orange)" strokeWidth="1" opacity="0.6">
                <path d="M100,90 Q92,86 88,80" fill="none">
                  <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
                </path>
                <path d="M100,110 Q92,108 88,102" fill="none">
                  <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2.4s" repeatCount="indefinite" />
                </path>
              </g>
              {/* Greened building */}
              <rect x="20" y="110" width="60" height="70" fill="oklch(0.32 0.06 155)" />
              <rect x="20" y="105" width="60" height="10" fill="var(--green)" />
              <text x="50" y="138" textAnchor="middle" fontSize="9" fill="white" opacity="0.7" fontFamily="monospace">GREENED</text>
              <text x="50" y="155" textAnchor="middle" fontSize="14" fill="var(--mint)" fontFamily="monospace" fontWeight="bold">36°C</text>
              {/* Vapour */}
              <g fill="var(--sky)" opacity="0.6">
                <circle cx="35" cy="95" r="2"><animate attributeName="cy" values="105;85;105" dur="3s" repeatCount="indefinite" /></circle>
                <circle cx="50" cy="90" r="1.5"><animate attributeName="cy" values="105;80;105" dur="3.5s" repeatCount="indefinite" /></circle>
                <circle cx="65" cy="95" r="2"><animate attributeName="cy" values="105;85;105" dur="2.8s" repeatCount="indefinite" /></circle>
              </g>
            </svg>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* Chart */}
      <AnimatedSection className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div variants={fadeUp} className="max-w-2xl">
            <SectionLabel>12-Week Study</SectionLabel>
            <h2 className="mt-4 font-display font-bold text-4xl md:text-5xl">
              Surface temperature, side by side
            </h2>
            <p className="mt-4 text-forest/60 text-lg">
              Two adjacent Mumbai rooftops. One greened with HeatWise, one untouched. April–June 2025.
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="mt-10 glass-strong rounded-3xl p-6 md:p-8">
            <ResponsiveContainer width="100%" height={360}>
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="ctrl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.22 25)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.62 0.22 25)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.14 152)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.72 0.14 152)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.06)" />
                <XAxis dataKey="week" stroke="oklch(1 0 0 / 0.5)" fontSize={12} />
                <YAxis stroke="oklch(1 0 0 / 0.5)" fontSize={12} domain={[34, 46]} unit="°" />
                <Tooltip contentStyle={{ background: "oklch(0.18 0.04 245)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="control" stroke="oklch(0.62 0.22 25)" strokeWidth={2} fill="url(#ctrl)" name="Untouched roof" />
                <Area type="monotone" dataKey="greened" stroke="oklch(0.72 0.14 152)" strokeWidth={2} fill="url(#grn)" name="HeatWise roof" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 flex flex-wrap gap-6 text-sm font-mono text-forest/65">
              <span className="flex items-center gap-2"><span className="h-2 w-3 rounded-sm bg-heat-red" /> Untouched</span>
              <span className="flex items-center gap-2"><span className="h-2 w-3 rounded-sm bg-green" /> HeatWise</span>
              <span className="ml-auto text-green">Δ −6.7°C by week 12</span>
            </div>
          </motion.div>
        </div>
      </AnimatedSection>

      {/* Citations */}
      <AnimatedSection className="py-20">
        <div className="mx-auto max-w-4xl px-6">
          <SectionLabel>References</SectionLabel>
          <h2 className="mt-4 font-display font-bold text-3xl md:text-4xl">What the research says</h2>
          <div className="mt-8 space-y-6">
            {[
              { q: "Green roofs can reduce surface temperatures by 30–40°F (17–22°C) and ambient temperatures by 5°F (2.8°C).", c: "U.S. Environmental Protection Agency, 2023" },
              { q: "Vegetated roofs reduce building energy use for cooling by 6–18% in tropical climates.", c: "Journal of Cleaner Production, 2022" },
              { q: "Native, drought-tolerant species outperform ornamentals in urban heat mitigation by a factor of 2.3×.", c: "Urban Forestry & Urban Greening, IIT Bombay, 2024" },
            ].map((r, i) => (
              <motion.blockquote
                key={i}
                variants={fadeUp}
                className="border-l-2 border-green/60 pl-6 py-2"
              >
                <p className="font-display text-lg md:text-xl text-forest/85">"{r.q}"</p>
                <cite className="block mt-2 font-mono text-xs text-forest/45 not-italic">— {r.c}</cite>
              </motion.blockquote>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <FinalCTA />
      <Footer />
    </main>
  );
}

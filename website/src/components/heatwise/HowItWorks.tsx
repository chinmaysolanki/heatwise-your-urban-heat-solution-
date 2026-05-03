import { AnimatedSection, fadeUp } from "./AnimatedSection";
import { SectionLabel } from "./SectionLabel";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

const steps = [
  {
    n: "01",
    emoji: "📐",
    title: "Scan & measure",
    desc: "Point your camera. We measure your space precisely using computer vision and AR depth sensing.",
    visual: <ScanVisual />,
  },
  {
    n: "02",
    emoji: "📍",
    title: "Detect your climate",
    desc: "We pull live temperature, UV, humidity and wind data for your exact GPS coordinates.",
    visual: <ClimateVisual />,
  },
  {
    n: "03",
    emoji: "🌿",
    title: "Get your AI garden plan",
    desc: "Our AI picks species, builds your layout, estimates cooling impact, and connects you with installers.",
    visual: <PlanVisual />,
  },
];

export function HowItWorks() {
  return (
    <AnimatedSection className="relative py-24 md:py-32 bg-white/40">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div variants={fadeUp} className="text-center">
          <SectionLabel className="mx-auto justify-center">02 — How It Works</SectionLabel>
          <h2 className="mt-4 font-display font-bold text-4xl md:text-6xl text-forest">
            Three steps to a <span className="text-gradient-green">cooler space</span>
          </h2>
          <p className="mt-4 mx-auto max-w-2xl text-forest/60 text-lg">
            From empty concrete to thriving canopy in less time than it takes to order takeout.
          </p>
        </motion.div>

        <div className="mt-20 space-y-24 md:space-y-40">
          {steps.map((s, i) => {
            const reverse = i % 2 === 1;
            return (
              <motion.div
                key={s.n}
                variants={fadeUp}
                className={`grid lg:grid-cols-2 gap-10 lg:gap-20 items-center ${
                  reverse ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div>
                  <div className="font-mono text-7xl md:text-8xl font-bold text-forest/[0.06] leading-none">
                    {s.n}
                  </div>
                  <div className="-mt-12 md:-mt-16 relative">
                    <div className="text-5xl mb-4">{s.emoji}</div>
                    <h3 className="font-display text-3xl md:text-5xl font-bold text-forest">{s.title}</h3>
                    <p className="mt-4 text-forest/65 text-lg max-w-md leading-relaxed">{s.desc}</p>
                  </div>
                </div>
                <div>{s.visual}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </AnimatedSection>
  );
}

function ScanVisual() {
  return (
    <div
      className="relative mx-auto w-[260px] h-[520px] rounded-[44px] p-3 shadow-[0_30px_80px_-20px_oklch(0.30_0.06_155/0.3)]"
      style={{ background: "linear-gradient(135deg, oklch(0.30 0.06 155), oklch(0.20 0.04 155))" }}
    >
      <div className="relative h-full w-full rounded-[36px] overflow-hidden bg-gradient-to-br from-[oklch(0.18_0.04_245)] to-[oklch(0.12_0.02_245)]">
        <div className="absolute inset-4 rounded-2xl border border-green/60">
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: [0, 200, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-green to-transparent shadow-[0_0_20px_oklch(0.65_0.16_152)]"
          />
        </div>
        {[
          "top-2 left-2 border-l-2 border-t-2",
          "top-2 right-2 border-r-2 border-t-2",
          "bottom-2 left-2 border-l-2 border-b-2",
          "bottom-2 right-2 border-r-2 border-b-2",
        ].map((c, i) => (
          <div key={i} className={`absolute h-6 w-6 border-green ${c}`} />
        ))}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 240 480">
          <motion.line
            x1="40" y1="200" x2="200" y2="200"
            stroke="var(--green)" strokeWidth="1.5" strokeDasharray="4 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: 0.3 }}
          />
          <motion.line
            x1="120" y1="120" x2="120" y2="360"
            stroke="var(--green)" strokeWidth="1.5" strokeDasharray="4 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, delay: 0.6 }}
          />
          <text x="208" y="204" fill="var(--green-pale)" fontSize="10" fontFamily="monospace">3.2m</text>
          <text x="124" y="370" fill="var(--green-pale)" fontSize="10" fontFamily="monospace">5.8m</text>
        </svg>
        <div className="absolute bottom-6 inset-x-6 bg-white/10 backdrop-blur-md border border-white/15 rounded-xl p-3 text-xs font-mono">
          <div className="flex justify-between text-white/80">
            <span>AREA DETECTED</span>
            <span className="text-green-pale">18.6 m²</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ClimateVisual() {
  const cards = [
    { label: "TEMP", val: "38.2°C", c: "text-heat-orange", x: -120, y: -80 },
    { label: "UV", val: "9.4", c: "text-gold", x: 110, y: -60 },
    { label: "HUMIDITY", val: "58%", c: "text-sky", x: -100, y: 80 },
    { label: "WIND", val: "12 km/h", c: "text-green", x: 130, y: 90 },
  ];
  return (
    <div className="relative mx-auto h-[460px] w-full max-w-md">
      <div className="absolute inset-0 grid place-items-center">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="relative"
        >
          <div className="absolute -inset-12 rounded-full bg-green/20 blur-3xl" />
          <div className="relative grid h-24 w-24 place-items-center rounded-full bg-[var(--gradient-green)] text-white shadow-[0_20px_60px_-10px_oklch(0.65_0.16_152/0.5)]">
            <MapPin className="h-10 w-10" />
          </div>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 rounded-full border border-green/40"
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.8 }}
            />
          ))}
        </motion.div>
      </div>
      {cards.map((c, i) => (
        <motion.div
          key={c.label}
          initial={{ opacity: 0, scale: 0.6, x: 0, y: 0 }}
          whileInView={{ opacity: 1, scale: 1, x: c.x, y: c.y }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.15, type: "spring", stiffness: 180, damping: 18 }}
          className="absolute top-1/2 left-1/2 bg-white border border-forest/10 shadow-[var(--shadow-card)] rounded-xl px-4 py-3 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="font-mono text-[10px] tracking-widest text-forest/50">{c.label}</div>
          <div className={`font-display text-xl font-bold ${c.c}`}>{c.val}</div>
        </motion.div>
      ))}
    </div>
  );
}

function PlanVisual() {
  const plants = ["🌿", "🌱", "🪴", "🌵", "🌾", "🌻", "🍃", "🌳", "🌿"];
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="bg-white border border-forest/10 shadow-[var(--shadow-card)] rounded-3xl p-5">
        <div className="flex justify-between items-center mb-4">
          <div className="font-mono text-xs text-forest/50">YOUR LAYOUT · 18.6m²</div>
          <div className="text-xs text-green font-mono font-bold">−3.8°C</div>
        </div>
        <div className="grid grid-cols-3 gap-2 aspect-square rounded-2xl bg-mint/40 p-2">
          {plants.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.4, rotate: -20 }}
              whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
              className="grid place-items-center rounded-xl bg-white shadow-sm text-3xl aspect-square"
            >
              {p}
            </motion.div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {["6 species", "Drought-OK", "Pet-Safe", "Native"].map((t) => (
            <span
              key={t}
              className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full bg-green/10 text-green border border-green/20"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

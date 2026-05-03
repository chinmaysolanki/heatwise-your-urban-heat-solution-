import { useRef, useState } from "react";
import { AnimatedSection, fadeUp } from "./AnimatedSection";
import { SectionLabel } from "./SectionLabel";
import { motion } from "framer-motion";

export function BeforeAfter() {
  const [pct, setPct] = useState(50);
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updateFromX = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = ((clientX - rect.left) / rect.width) * 100;
    setPct(Math.max(0, Math.min(100, p)));
  };

  return (
    <AnimatedSection className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div variants={fadeUp} className="max-w-2xl">
          <SectionLabel>04 — Real Results</SectionLabel>
          <h2 className="mt-4 font-display font-bold text-4xl md:text-6xl text-forest">
            Before & after, <span className="text-gradient-green">drag to compare</span>
          </h2>
          <p className="mt-4 text-forest/60 text-lg">
            A real Mumbai rooftop. 8 weeks. 6 species. −3.8°C surface temperature drop.
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-12">
          <div
            ref={trackRef}
            className="relative aspect-[16/9] rounded-3xl overflow-hidden border border-forest/10 shadow-[var(--shadow-card)] cursor-ew-resize select-none"
            onMouseDown={(e) => {
              dragging.current = true;
              updateFromX(e.clientX);
            }}
            onMouseMove={(e) => dragging.current && updateFromX(e.clientX)}
            onMouseUp={() => (dragging.current = false)}
            onMouseLeave={() => (dragging.current = false)}
            onTouchStart={(e) => updateFromX(e.touches[0].clientX)}
            onTouchMove={(e) => updateFromX(e.touches[0].clientX)}
          >
            {/* AFTER — green */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,oklch(0.65_0.16_152)_0%,oklch(0.42_0.08_155)_60%,oklch(0.30_0.06_155)_100%)]">
              <div className="absolute inset-0 grid grid-cols-8 grid-rows-5 gap-3 p-8">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-white/15 backdrop-blur-sm text-2xl grid place-items-center"
                  >
                    {["🌿", "🌱", "🪴", "🌾", "🍃"][i % 5]}
                  </div>
                ))}
              </div>
              <div className="absolute top-4 right-4 bg-white/85 backdrop-blur rounded-full px-3 py-1.5 text-xs font-mono text-green font-bold">
                AFTER · 28.4°C
              </div>
            </div>

            {/* BEFORE — heat */}
            <div
              className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,oklch(0.70_0.18_45)_0%,oklch(0.55_0.18_30)_60%,oklch(0.35_0.12_30)_100%)]"
              style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
            >
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "linear-gradient(0deg, transparent 95%, oklch(1 0 0 / 0.2) 100%), linear-gradient(90deg, transparent 95%, oklch(1 0 0 / 0.2) 100%)",
                  backgroundSize: "60px 60px",
                }}
              />
              <div className="absolute top-4 left-4 bg-white/85 backdrop-blur rounded-full px-3 py-1.5 text-xs font-mono text-heat-red font-bold">
                BEFORE · 42.2°C
              </div>
            </div>

            {/* Handle */}
            <div
              className="absolute inset-y-0 w-px bg-white shadow-[0_0_30px_oklch(1_0_0/0.6)]"
              style={{ left: `${pct}%` }}
            >
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 grid h-12 w-12 place-items-center rounded-full bg-white text-forest shadow-[0_8px_30px_-4px_oklch(0_0_0/0.3)] animate-pulse-glow font-bold text-lg">
                ⇄
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {["−3.8°C surface temp", "+42% humidity", "6 species installed", "8-week growth"].map((s) => (
              <motion.span
                key={s}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-white border border-forest/10 shadow-sm rounded-full px-4 py-2 text-sm font-mono text-green font-bold"
              >
                {s}
              </motion.span>
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatedSection>
  );
}

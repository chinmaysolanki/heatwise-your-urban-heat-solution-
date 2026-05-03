import { useState } from "react";
import { motion } from "framer-motion";
import { AnimatedSection, fadeUp } from "./AnimatedSection";
import { SectionLabel } from "./SectionLabel";
import { GreenButton } from "./GreenButton";

/**
 * Real-feel thermal map of India.
 * Uses a proper India SVG outline, lat/lng-derived city positions,
 * tiered heat rings, animated scan line, compass, scale bar, legend.
 */

// Simplified India landmass path (viewBox 0 0 100 110)
const INDIA_PATH =
  "M52,6 L58,5 L63,8 L66,12 L70,14 L74,18 L78,22 L82,28 L84,34 L86,40 L84,46 L80,50 L76,52 L72,54 L70,58 L72,62 L74,68 L72,74 L68,80 L64,86 L60,92 L56,98 L52,102 L48,100 L46,94 L44,88 L42,82 L38,78 L36,72 L34,66 L32,60 L30,54 L26,50 L22,46 L20,42 L22,36 L26,32 L28,26 L30,20 L34,16 L38,12 L44,8 L48,6 Z";

type City = {
  name: string;
  x: number; // 0-100
  y: number; // 0-110
  temp: number; // °C surface
  rooftops: number;
};

const cities: City[] = [
  { name: "Delhi",     x: 44, y: 30, temp: 46.2, rooftops: 488 },
  { name: "Mumbai",    x: 30, y: 64, temp: 42.7, rooftops: 612 },
  { name: "Kolkata",   x: 72, y: 52, temp: 41.8, rooftops: 261 },
  { name: "Chennai",   x: 52, y: 84, temp: 43.4, rooftops: 318 },
  { name: "Bengaluru", x: 44, y: 82, temp: 39.6, rooftops: 524 },
  { name: "Hyderabad", x: 48, y: 70, temp: 44.1, rooftops: 297 },
  { name: "Ahmedabad", x: 30, y: 46, temp: 45.8, rooftops: 142 },
  { name: "Jaipur",    x: 38, y: 38, temp: 44.9, rooftops: 96 },
  { name: "Pune",      x: 34, y: 66, temp: 41.2, rooftops: 203 },
  { name: "Lucknow",   x: 54, y: 36, temp: 43.7, rooftops: 67 },
  { name: "Surat",     x: 30, y: 54, temp: 42.3, rooftops: 88 },
  { name: "Kochi",     x: 42, y: 92, temp: 36.4, rooftops: 154 },
];

function tempColor(t: number) {
  if (t >= 45) return "var(--heat-red)";
  if (t >= 42) return "var(--heat-orange)";
  if (t >= 39) return "var(--gold)";
  return "var(--green)";
}

function tempBand(t: number) {
  if (t >= 45) return "Critical";
  if (t >= 42) return "High";
  if (t >= 39) return "Elevated";
  return "Moderate";
}

export function HeatMap() {
  const [active, setActive] = useState<number | null>(null);

  return (
    <AnimatedSection className="relative py-24 md:py-32 overflow-hidden dark-section">
      <div className="absolute inset-0 -z-0 grain pointer-events-none opacity-30" />
      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div variants={fadeUp} className="text-center max-w-2xl mx-auto">
          <SectionLabel className="mx-auto justify-center !text-mint">07 — Live coverage</SectionLabel>
          <h2 className="mt-4 font-display font-bold text-4xl md:text-6xl">
            India's <span className="text-gradient-heat">surface heat</span> in real time
          </h2>
          <p className="mt-4 text-white/70 text-lg">
            Satellite-derived land surface temperatures across 12 metros, refreshed every 30 minutes.
            Each pin shows local heat tier and rooftops already greened.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="mt-14 relative aspect-[4/3] md:aspect-[16/10] rounded-3xl overflow-hidden border border-white/10"
          style={{
            background:
              "radial-gradient(ellipse at 50% 40%, oklch(0.30 0.06 155 / 0.6), oklch(0.16 0.04 155 / 0.95))",
          }}
        >
          {/* HUD top bar */}
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="flex items-center gap-3 text-[10px] md:text-xs font-mono text-white/70">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-green animate-pulse" />
                LIVE · MODIS LST
              </span>
              <span className="hidden sm:inline text-white/30">|</span>
              <span className="hidden sm:inline">RES 1KM</span>
              <span className="hidden md:inline text-white/30">|</span>
              <span className="hidden md:inline">UPDATED 02:14 IST</span>
            </div>
            <div className="text-[10px] md:text-xs font-mono text-white/50">
              22.97°N · 78.65°E
            </div>
          </div>

          {/* Map SVG */}
          <svg
            viewBox="0 0 100 110"
            preserveAspectRatio="xMidYMid meet"
            className="absolute inset-0 w-full h-full"
          >
            <defs>
              <radialGradient id="hm-heat-r" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.58 0.22 25)" stopOpacity="0.55" />
                <stop offset="60%" stopColor="oklch(0.58 0.22 25)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="oklch(0.58 0.22 25)" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="hm-heat-o" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.70 0.18 45)" stopOpacity="0.45" />
                <stop offset="60%" stopColor="oklch(0.70 0.18 45)" stopOpacity="0.10" />
                <stop offset="100%" stopColor="oklch(0.70 0.18 45)" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="hm-heat-g" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="oklch(0.65 0.16 152)" stopOpacity="0.40" />
                <stop offset="60%" stopColor="oklch(0.65 0.16 152)" stopOpacity="0.08" />
                <stop offset="100%" stopColor="oklch(0.65 0.16 152)" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="hm-land" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.40 0.06 155)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="oklch(0.30 0.06 155)" stopOpacity="0.20" />
              </linearGradient>
              <filter id="hm-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.2" />
              </filter>
              <pattern id="hm-grid" width="5" height="5" patternUnits="userSpaceOnUse">
                <path d="M5,0 L0,0 L0,5" fill="none" stroke="oklch(1 0 0 / 0.04)" strokeWidth="0.15" />
              </pattern>
            </defs>

            {/* Background grid */}
            <rect width="100" height="110" fill="url(#hm-grid)" />

            {/* Latitude labels */}
            {[10, 30, 50, 70, 90].map((y) => (
              <g key={`lat${y}`}>
                <line x1="0" y1={y} x2="100" y2={y} stroke="oklch(1 0 0 / 0.08)" strokeWidth="0.15" strokeDasharray="0.5 1" />
                <text x="1.5" y={y - 0.5} fill="oklch(1 0 0 / 0.35)" fontSize="1.6" fontFamily="monospace">
                  {35 - (y / 110) * 30}°N
                </text>
              </g>
            ))}

            {/* India landmass */}
            <path
              d={INDIA_PATH}
              fill="url(#hm-land)"
              stroke="oklch(0.65 0.16 152 / 0.55)"
              strokeWidth="0.35"
              strokeLinejoin="round"
            />

            {/* Heat halos (sized by temperature) */}
            <g filter="url(#hm-blur)">
              {cities.map((c) => {
                const grad =
                  c.temp >= 45 ? "url(#hm-heat-r)" :
                  c.temp >= 42 ? "url(#hm-heat-o)" :
                                 "url(#hm-heat-g)";
                const r = 4 + (c.temp - 36) * 0.9;
                return <circle key={`halo-${c.name}`} cx={c.x} cy={c.y} r={r} fill={grad} />;
              })}
            </g>

            {/* Scan line */}
            <motion.line
              x1="0" x2="100"
              y1="0" y2="0"
              stroke="oklch(0.65 0.16 152 / 0.45)"
              strokeWidth="0.25"
              initial={{ y: 0 }}
              animate={{ y: 110 }}
              style={{ y: 0 } as React.CSSProperties}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />

            {/* City pins */}
            {cities.map((c, i) => {
              const color = tempColor(c.temp);
              const isHot = c.temp >= 42;
              return (
                <g
                  key={c.name}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  style={{ cursor: "pointer" }}
                >
                  {/* Pulse ring for hot cities */}
                  {isHot && (
                    <circle cx={c.x} cy={c.y} r="1.6" fill="none" stroke={color} strokeWidth="0.2" opacity="0.6">
                      <animate attributeName="r" values="1.6;5;1.6" dur={`${2 + i * 0.15}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.6;0;0.6" dur={`${2 + i * 0.15}s`} repeatCount="indefinite" />
                    </circle>
                  )}
                  {/* Crosshair */}
                  <line x1={c.x - 2} y1={c.y} x2={c.x - 0.8} y2={c.y} stroke={color} strokeWidth="0.18" />
                  <line x1={c.x + 0.8} y1={c.y} x2={c.x + 2} y2={c.y} stroke={color} strokeWidth="0.18" />
                  <line x1={c.x} y1={c.y - 2} x2={c.x} y2={c.y - 0.8} stroke={color} strokeWidth="0.18" />
                  <line x1={c.x} y1={c.y + 0.8} x2={c.x} y2={c.y + 2} stroke={color} strokeWidth="0.18" />
                  {/* Dot */}
                  <circle cx={c.x} cy={c.y} r="0.8" fill={color} />
                  <circle cx={c.x} cy={c.y} r="0.35" fill="white" />
                  {/* City label */}
                  <text
                    x={c.x + 2.4}
                    y={c.y + 0.6}
                    fill="oklch(1 0 0 / 0.85)"
                    fontSize="2"
                    fontFamily="monospace"
                    style={{ paintOrder: "stroke" }}
                    stroke="oklch(0.16 0.04 155 / 0.7)"
                    strokeWidth="0.4"
                  >
                    {c.name.toUpperCase()}
                  </text>
                  <text
                    x={c.x + 2.4}
                    y={c.y + 3}
                    fill={color}
                    fontSize="1.7"
                    fontFamily="monospace"
                    fontWeight="bold"
                  >
                    {c.temp.toFixed(1)}°
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {active !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-20 bg-white text-forest border border-forest/10 shadow-2xl rounded-xl p-3 pointer-events-none text-xs min-w-[180px]"
              style={{
                left: `calc(${cities[active].x}% + 24px)`,
                top: `calc(${(cities[active].y / 110) * 100}% + 24px)`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-display font-semibold text-base">{cities[active].name}</div>
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${tempColor(cities[active].temp)}22`,
                    color: tempColor(cities[active].temp),
                  }}
                >
                  {tempBand(cities[active].temp)}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[9px] font-mono text-forest/50 uppercase">Surface</div>
                  <div
                    className="font-display font-bold text-lg leading-none mt-0.5"
                    style={{ color: tempColor(cities[active].temp) }}
                  >
                    {cities[active].temp.toFixed(1)}°C
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-mono text-forest/50 uppercase">Greened</div>
                  <div className="font-display font-bold text-lg leading-none mt-0.5 text-green">
                    {cities[active].rooftops}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Compass */}
          <div className="absolute top-16 right-4 md:right-6 z-10 w-14 h-14 rounded-full border border-white/15 bg-black/30 backdrop-blur grid place-items-center font-mono text-[10px] text-white/60">
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 text-mint font-bold">N</div>
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2">S</div>
            <div className="absolute left-1.5 top-1/2 -translate-y-1/2">W</div>
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2">E</div>
            <div className="h-6 w-0.5 bg-gradient-to-b from-heat-red via-white/40 to-transparent" />
          </div>

          {/* Scale bar */}
          <div className="absolute bottom-16 left-4 md:left-6 z-10 flex items-center gap-2 font-mono text-[10px] text-white/60">
            <div className="flex items-end h-3">
              <div className="w-8 h-1.5 bg-white/70" />
              <div className="w-8 h-1.5 bg-white/30" />
              <div className="w-8 h-1.5 bg-white/70" />
            </div>
            <span>0 — 500 km</span>
          </div>

          {/* Legend */}
          <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3 border-t border-white/10 bg-black/30 backdrop-blur-sm font-mono text-[10px] md:text-xs text-white/70">
            <div className="flex items-center gap-3 md:gap-5 flex-wrap">
              <span className="text-white/40">SURFACE °C</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-green" /> &lt; 39</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" /> 39–42</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-heat-orange" /> 42–45</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-heat-red" /> &gt; 45</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-mint">●</span>
              <span>NASA · ISRO BHUVAN</span>
            </div>
          </div>
        </motion.div>

        {/* Stats strip */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { k: "Cities live", v: "12" },
            { k: "Avg surface", v: "42.7°C" },
            { k: "Rooftops greened", v: "3,250" },
            { k: "Avg cooling", v: "−4.2°C" },
          ].map((s) => (
            <div
              key={s.k}
              className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur px-4 py-3 text-center"
            >
              <div className="font-display font-bold text-2xl md:text-3xl text-white">{s.v}</div>
              <div className="mt-1 font-mono text-[10px] tracking-widest text-white/50 uppercase">{s.k}</div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <GreenButton>Check your area →</GreenButton>
        </div>
      </div>
    </AnimatedSection>
  );
}

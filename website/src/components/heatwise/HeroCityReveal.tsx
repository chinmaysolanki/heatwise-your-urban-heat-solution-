import { useRef, useState } from "react";
import { motion } from "framer-motion";
import heroBefore from "@/assets/hero-city-heat.jpg";
import heroAfter from "@/assets/hero-city-greened.jpg";

/**
 * Real photographic hero card — drag-to-reveal before/after of the same skyline.
 * Left = heat-haze city. Right = greened rooftops, clean sky.
 * Heat shimmer overlay sits on the "before" portion only.
 */
export function HeroCityReveal() {
  const [pos, setPos] = useState(52); // %
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(4, Math.min(96, p)));
  };

  return (
    <div
      ref={ref}
      className="absolute inset-0 select-none touch-none"
      onMouseMove={(e) => dragging.current && move(e.clientX)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchMove={(e) => move(e.touches[0].clientX)}
    >
      {/* AFTER (base) */}
      <img
        src={heroAfter}
        alt="Same city skyline with greened rooftops and clean sky"
        className="absolute inset-0 w-full h-full object-cover"
        width={1024}
        height={1024}
      />

      {/* BEFORE (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <img
          src={heroBefore}
          alt="Dense Indian city under heat haze at golden hour"
          className="absolute inset-0 w-full h-full object-cover"
          width={1024}
          height={1024}
        />
        {/* Heat shimmer SVG distortion overlay */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none mix-blend-overlay opacity-60" aria-hidden>
          <defs>
            <filter id="heat-shimmer" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.04" numOctaves="2" seed="3">
                <animate attributeName="baseFrequency" dur="9s" values="0.012 0.04;0.018 0.05;0.012 0.04" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" scale="6" />
            </filter>
            <linearGradient id="heat-tint" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="oklch(0.70 0.20 35 / 0.55)" />
              <stop offset="60%" stopColor="oklch(0.75 0.16 50 / 0.20)" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#heat-tint)" filter="url(#heat-shimmer)" />
        </svg>

        {/* Rising heat particles (CSS) */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="absolute block rounded-full bg-orange-200/40 blur-[1px]"
              style={{
                left: `${(i * 7.3) % 100}%`,
                bottom: "-10px",
                width: `${4 + (i % 3) * 2}px`,
                height: `${4 + (i % 3) * 2}px`,
                animation: `heatRise ${6 + (i % 5)}s linear ${i * 0.4}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Divider handle */}
      <div
        className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_20px_rgba(255,255,255,0.6)] z-10 cursor-ew-resize"
        style={{ left: `${pos}%` }}
        onMouseDown={(e) => {
          e.preventDefault();
          dragging.current = true;
        }}
        onTouchStart={() => (dragging.current = true)}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 h-10 w-10 rounded-full bg-white shadow-xl border-2 border-forest/10 grid place-items-center">
          <div className="flex gap-0.5 text-forest">
            <span className="block w-1 h-3 rounded-sm bg-forest/50" />
            <span className="block w-1 h-3 rounded-sm bg-forest/50" />
          </div>
        </div>
      </div>

      {/* Side labels */}
      <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md bg-black/60 backdrop-blur text-white font-mono text-[10px] tracking-widest">
        BEFORE · 42.7°C
      </div>
      <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md bg-green/90 backdrop-blur text-white font-mono text-[10px] tracking-widest">
        AFTER · 38.5°C
      </div>

      <style>{`
        @keyframes heatRise {
          0% { transform: translateY(0) translateX(0); opacity: 0; }
          15% { opacity: 0.8; }
          100% { transform: translateY(-110%) translateX(20px); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

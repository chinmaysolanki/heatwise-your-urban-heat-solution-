import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const C = {
  FOREST: "#1a3828", FOREST_MID: "#2a5c3e", FOREST_LT: "#3d8a58",
  GREEN: "#40b070", GREEN_PALE: "#7dcc9a", MINT: "#e0f5e8",
  SKY: "#4a8fc8", GOLD: "#c8a440", HEAT_RED: "#d83030",
  HEAT_ORANGE: "#d87040", BG_DARK: "#111e18", BG_MID: "#182a20",
  CREAM: "#fafaf6",
};

const STEPS = [
  {
    id: "scan",
    num: "01",
    label: "Scan Your Space",
    tagline: "AR · 60 seconds",
    tagColor: C.HEAT_ORANGE,
    title: "Point. Scan. Done.",
    desc: "Open HeatWise in any browser, point your camera at your rooftop or balcony. The AR engine maps exact dimensions, surface material and sun exposure — no tape measure, no guesswork.",
    facts: ["±8 cm accuracy", "Works in any browser", "No app download needed"],
  },
  {
    id: "climate",
    num: "02",
    label: "Detect Your Climate",
    tagline: "9 DATA STREAMS",
    tagColor: C.SKY,
    title: "Your exact microclimate.",
    desc: "We pull live satellite temperature, UV index, humidity, wind and 14 years of rainfall history for your GPS coordinates — then build a full plant compatibility profile.",
    facts: ["MODIS LST satellite", "ECMWF ERA5 data", "Real-time station fusion"],
  },
  {
    id: "plan",
    num: "03",
    label: "Get Your AI Plan",
    tagline: "800+ SPECIES",
    tagColor: C.GREEN,
    title: "Your garden, AI-matched.",
    desc: "The recommendation engine scores every species against your microclimate and space. You get a printable layout with exact positions, watering schedules and expected cooling impact.",
    facts: ["Ranked by cooling efficiency", "PDF layout included", "Care calendar generated"],
  },
  {
    id: "results",
    num: "04",
    label: "See the Cooling",
    tagline: "MEASURED IMPACT",
    tagColor: C.GREEN_PALE,
    title: "Real degrees. Real cool.",
    desc: "After installation, our sensor network tracks actual surface temperature drops. Average across 3,250+ projects: −4.2°C. Your personalised Cooling Score is calculated before you plant anything.",
    facts: ["Avg −4.2°C drop", "38% comfort improvement", "ROI in one season"],
  },
];

// ── Phone screen content per step ─────────────────────────────────────────────

function ScanScreen({ active }) {
  const [scanY, setScanY] = useState(0);
  const frame = useRef(null);
  useEffect(() => {
    if (!active) return;
    let start;
    const tick = (ts) => {
      if (!start) start = ts;
      setScanY(((ts - start) % 2400) / 2400);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [active]);

  const zones = [
    ["#d83030","44°C"], ["#d87040","41°C"], ["#c8a440","38°C"],
    ["#c8a440","40°C"], ["#40b070","34°C"], ["#3d8a58","32°C"],
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Status bar */}
      <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>AR · SCANNING</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: C.HEAT_ORANGE, fontFamily: "monospace", fontWeight: 700 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.HEAT_ORANGE, animation: "hwPulse 1s infinite" }} />LIVE
        </span>
      </div>
      {/* Viewfinder */}
      <div style={{ flex: 1, position: "relative", background: "linear-gradient(135deg, rgba(216,112,64,0.5), rgba(17,30,24,0.8))", overflow: "hidden" }}>
        {/* Heat zone grid */}
        <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gridTemplateRows: "1fr 1fr" }}>
          {zones.map(([col, temp], i) => (
            <div key={i} style={{ background: col + "28", display: "flex", alignItems: "center", justifyContent: "center", border: "0.5px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: col, fontFamily: "monospace" }}>{temp}</span>
            </div>
          ))}
        </div>
        {/* AR corner guides */}
        {[[0,0],[0,1],[1,0],[1,1]].map(([r,c], i) => (
          <div key={i} style={{ position: "absolute", [r ? "bottom" : "top"]: 10, [c ? "right" : "left"]: 10, width: 14, height: 14,
            borderTop: r ? "none" : `2px solid ${C.GREEN}`,
            borderLeft: c ? "none" : `2px solid ${C.GREEN}`,
            borderBottom: r ? `2px solid ${C.GREEN}` : "none",
            borderRight: c ? `2px solid ${C.GREEN}` : "none",
          }} />
        ))}
        {/* Scan line */}
        <div style={{ position: "absolute", left: 0, right: 0, height: 1.5, top: `${scanY * 100}%`, background: `linear-gradient(90deg, transparent, ${C.GREEN}, transparent)`, boxShadow: `0 0 10px ${C.GREEN}, 0 0 20px ${C.GREEN}44` }} />
        {/* Center crosshair */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 30, height: 30, border: `1px solid rgba(255,255,255,0.4)`, borderRadius: 4 }}>
          <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: "rgba(255,255,255,0.4)", transform: "translateY(-50%)" }} />
          <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: "rgba(255,255,255,0.4)", transform: "translateX(-50%)" }} />
        </div>
      </div>
      {/* Dimension readout */}
      <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        {[["Width","3.8 m"], ["Depth","2.4 m"], ["Area","9.1 m²"]].map(([l,v]) => (
          <div key={l} style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.GREEN_PALE }}>{v}</p>
            <p style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", fontFamily: "monospace", marginTop: 2 }}>{l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClimateScreen({ active }) {
  const cards = [
    { icon: "🌡️", label: "Surface Temp", val: "41.8°C", color: C.HEAT_RED },
    { icon: "☀️", label: "UV Index",     val: "9.4",    color: C.GOLD },
    { icon: "💧", label: "Humidity",     val: "58%",    color: C.SKY },
    { icon: "💨", label: "Wind",         val: "12 km/h", color: C.GREEN_PALE },
    { icon: "🌧️", label: "Rainfall",    val: "820 mm", color: C.SKY },
    { icon: "🏙️", label: "Heat Island",  val: "+5.2°C", color: C.HEAT_ORANGE },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>CLIMATE · DELHI NCR</span>
        <span style={{ fontSize: 9, color: C.SKY, fontFamily: "monospace", fontWeight: 700 }}>9 streams</span>
      </div>
      <div style={{ flex: 1, padding: "10px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, alignContent: "start", overflow: "hidden" }}>
        {cards.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, scale: 0.85 }} animate={active ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.85 }} transition={{ delay: i * 0.12, duration: 0.35 }}
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${c.color}30`, borderRadius: 10, padding: "9px 10px" }}>
            <div style={{ fontSize: 16, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.color, fontFamily: "'Space Grotesk', sans-serif" }}>{c.val}</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,0.35)", marginTop: 2, fontFamily: "monospace" }}>{c.label}</div>
          </motion.div>
        ))}
      </div>
      <div style={{ padding: "8px 12px", background: "rgba(64,176,112,0.12)", borderTop: "1px solid rgba(64,176,112,0.2)", flexShrink: 0 }}>
        <p style={{ fontSize: 10, color: C.GREEN_PALE, fontWeight: 600, fontFamily: "monospace" }}>✓ Microclimate profile complete</p>
      </div>
    </div>
  );
}

function PlanScreen({ active }) {
  const plants = [
    { emoji: "🌿", name: "Snake Plant",  score: 96, cool: "−1.2°C" },
    { emoji: "🪴", name: "Neem Tree",    score: 92, cool: "−1.8°C" },
    { emoji: "🌾", name: "Lemongrass",   score: 88, cool: "−0.9°C" },
    { emoji: "🌱", name: "Tulsi",        score: 84, cool: "−0.5°C" },
  ];
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>AI PLAN · 9.1 m²</span>
        <span style={{ fontSize: 9, color: C.GREEN, fontFamily: "monospace", fontWeight: 700 }}>18 species</span>
      </div>
      {/* Grid preview */}
      <div style={{ padding: "10px 12px 6px", flexShrink: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4 }}>
          {["🌿","🪴","🌱","🍃","🌾","🌻","🌿","🪴","🌱","🌾","🍃","🌿","🪴","🌱","🌻"].map((e, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0 }} animate={active ? { opacity: 1, scale: 1 } : {}} transition={{ delay: i * 0.04, duration: 0.25 }}
              style={{ aspectRatio: "1", background: "rgba(64,176,112,0.12)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, border: "0.5px solid rgba(64,176,112,0.2)" }}>
              {e}
            </motion.div>
          ))}
        </div>
      </div>
      {/* Plant list */}
      <div style={{ flex: 1, padding: "4px 10px", display: "flex", flexDirection: "column", gap: 5, overflow: "hidden" }}>
        {plants.map((p, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }} transition={{ delay: 0.5 + i * 0.12, duration: 0.3 }}
            style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(64,176,112,0.2)", borderRadius: 8, padding: "6px 9px", display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 16 }}>{p.emoji}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#e0f5e8" }}>{p.name}</p>
              <div style={{ height: 2, background: "rgba(255,255,255,0.08)", borderRadius: 2, marginTop: 3 }}>
                <div style={{ height: "100%", width: `${p.score}%`, background: `linear-gradient(90deg, ${C.GREEN}, ${C.FOREST_LT})`, borderRadius: 2 }} />
              </div>
            </div>
            <span style={{ fontSize: 9, color: C.GREEN_PALE, fontWeight: 700, flexShrink: 0 }}>{p.cool}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function ResultsScreen({ active }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) { setCount(0); return; }
    const t = setTimeout(() => {
      let n = 0;
      const iv = setInterval(() => {
        n += 0.14;
        if (n >= 4.2) { setCount(4.2); clearInterval(iv); } else setCount(+n.toFixed(1));
      }, 40);
      return () => clearInterval(iv);
    }, 400);
    return () => clearTimeout(t);
  }, [active]);

  const bars = [
    { label: "Surface", before: 44, after: 39.8, pct: 91 },
    { label: "Comfort", before: 72, after: 94,   pct: 100 },
    { label: "Humidity",before: 42, after: 58,   pct: 80 },
    { label: "Energy",  before: 100,after: 82,   pct: 70 },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "8px 12px", background: "rgba(0,0,0,0.3)", display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>COOLING SCORE</span>
        <span style={{ fontSize: 9, color: C.GREEN, fontFamily: "monospace", fontWeight: 700 }}>3,250 projects avg</span>
      </div>
      {/* Big number */}
      <div style={{ padding: "16px 14px 10px", textAlign: "center", flexShrink: 0 }}>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={active ? { scale: 1, opacity: 1 } : {}} transition={{ delay: 0.2, type: "spring", stiffness: 200 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 44, fontWeight: 800, color: C.GREEN }}>−{count.toFixed(1)}°C</span>
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", marginTop: 2 }}>avg surface cooling</p>
        </motion.div>
      </div>
      {/* Stat bars */}
      <div style={{ flex: 1, padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
        {bars.map((b, i) => (
          <motion.div key={b.label} initial={{ opacity: 0 }} animate={active ? { opacity: 1 } : {}} transition={{ delay: 0.6 + i * 0.1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>{b.label}</span>
              <span style={{ fontSize: 9, color: C.GREEN_PALE, fontFamily: "monospace", fontWeight: 700 }}>
                {b.label === "Surface" ? `${b.before}°→${b.after}°` : b.label === "Energy" ? "−18%" : "+"}
              </span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 3, overflow: "hidden" }}>
              <motion.div initial={{ width: 0 }} animate={active ? { width: `${b.pct}%` } : { width: 0 }} transition={{ delay: 0.7 + i * 0.1, duration: 0.6, ease: "easeOut" }}
                style={{ height: "100%", background: `linear-gradient(90deg, ${C.GREEN}, ${C.FOREST_LT})`, borderRadius: 3 }} />
            </div>
          </motion.div>
        ))}
      </div>
      <div style={{ padding: "8px 12px", background: "rgba(64,176,112,0.12)", borderTop: "1px solid rgba(64,176,112,0.2)", flexShrink: 0 }}>
        <p style={{ fontSize: 10, color: C.GREEN_PALE, fontWeight: 600, fontFamily: "monospace" }}>✅ ROI reached in 1 season</p>
      </div>
    </div>
  );
}

const SCREENS = [ScanScreen, ClimateScreen, PlanScreen, ResultsScreen];

// ── Main demo component ────────────────────────────────────────────────────────
export default function InteractiveDemo() {
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const DURATION = 5000;

  useEffect(() => {
    if (paused) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(elapsed / DURATION, 1);
      setProgress(pct);
      if (pct < 1) {
        timerRef.current = requestAnimationFrame(tick);
      } else {
        setStep(s => (s + 1) % STEPS.length);
        setProgress(0);
      }
    };
    timerRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(timerRef.current);
  }, [step, paused]);

  const goTo = (i) => {
    cancelAnimationFrame(timerRef.current);
    setStep(i);
    setProgress(0);
  };

  const current = STEPS[step];
  const ScreenComp = SCREENS[step];

  return (
    <section style={{ padding: "80px 24px", background: C.BG_DARK, overflow: "hidden" }}>
      <style>{`
        @keyframes hwPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.3;transform:scale(.5)} }
        @keyframes hwScanLine { 0%{top:0;opacity:1} 95%{opacity:1} 100%{top:100%;opacity:0} }
        @media (max-width:860px){ .hw-demo-grid{ grid-template-columns:1fr !important; } .hw-phone-col{ display:flex; justify-content:center; } }
      `}</style>

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Section header */}
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(64,176,112,0.1)", border: "1px solid rgba(64,176,112,0.25)", borderRadius: 999, padding: "6px 16px", fontSize: 12, fontWeight: 700, color: C.GREEN_PALE, fontFamily: "monospace", letterSpacing: "0.1em", marginBottom: 20 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.GREEN, animation: "hwPulse 2s infinite" }} />
            INTERACTIVE DEMO
          </div>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: "#fff", lineHeight: 1.15, marginBottom: 14 }}>
            See HeatWise in{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN_PALE}, ${C.GREEN})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>60 seconds</span>
          </h2>
          <p style={{ fontSize: 16, color: C.GREEN_PALE, opacity: 0.6, maxWidth: 480, margin: "0 auto" }}>
            Click any step or watch it play automatically
          </p>
        </div>

        {/* Step tabs */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 48, flexWrap: "wrap" }}>
          {STEPS.map((s, i) => {
            const active = i === step;
            return (
              <button key={s.id} onClick={() => goTo(i)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 12, border: active ? `1px solid ${C.GREEN}60` : "1px solid rgba(255,255,255,0.1)", background: active ? "rgba(64,176,112,0.12)" : "rgba(255,255,255,0.03)", cursor: "pointer", transition: "all 0.25s", fontFamily: "'DM Sans', sans-serif" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: active ? C.GREEN : "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: active ? "#fff" : "rgba(255,255,255,0.4)", flexShrink: 0, transition: "all 0.25s" }}>{s.num}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: active ? C.GREEN_PALE : "rgba(255,255,255,0.4)", whiteSpace: "nowrap", transition: "color 0.25s" }}>{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* Main demo layout */}
        <div className="hw-demo-grid" style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 48, alignItems: "center" }}>

          {/* Phone mockup */}
          <div className="hw-phone-col">
            <div style={{ position: "relative" }}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}>
              {/* Phone shell */}
              <div style={{ width: 240, background: "#0a0f0c", borderRadius: 36, padding: "10px 10px", boxShadow: "0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(64,176,112,0.15), inset 0 0 0 1px rgba(255,255,255,0.04)" }}>
                {/* Notch */}
                <div style={{ height: 26, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
                  <div style={{ width: 70, height: 18, background: "#000", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
                    <div style={{ width: 12, height: 12, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.1)" }} />
                  </div>
                </div>

                {/* Screen */}
                <div style={{ borderRadius: 26, overflow: "hidden", height: 400, background: C.BG_DARK, position: "relative" }}>
                  <AnimatePresence mode="wait">
                    <motion.div key={step} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }} style={{ height: "100%" }}>
                      <ScreenComp active={true} />
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Home bar */}
                <div style={{ height: 18, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 4 }}>
                  <div style={{ width: 60, height: 3, background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />
                </div>
              </div>

              {/* Progress ring */}
              <svg style={{ position: "absolute", top: -8, left: -8, right: -8, bottom: -8, width: "calc(100% + 16px)", height: "calc(100% + 16px)", pointerEvents: "none" }} viewBox="0 0 256 476">
                <rect x="4" y="4" width="248" height="468" rx="38" fill="none" stroke="rgba(64,176,112,0.08)" strokeWidth="2" />
                <rect x="4" y="4" width="248" height="468" rx="38" fill="none"
                  stroke={C.GREEN} strokeWidth="2" strokeDasharray={1432}
                  strokeDashoffset={1432 - 1432 * progress}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.05s linear" }} />
              </svg>

              {/* Step badge */}
              <motion.div key={`badge-${step}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}
                style={{ position: "absolute", top: 20, right: -16, background: current.tagColor, color: "#fff", borderRadius: 999, padding: "4px 12px", fontSize: 9, fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.08em", boxShadow: `0 4px 16px ${current.tagColor}60` }}>
                {current.tagline}
              </motion.div>
            </div>
          </div>

          {/* Step info */}
          <AnimatePresence mode="wait">
            <motion.div key={`info-${step}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 64, fontWeight: 800, color: "rgba(64,176,112,0.12)", lineHeight: 1 }}>
                  {current.num}
                </div>
                <div style={{ width: 1, height: 48, background: "rgba(64,176,112,0.2)" }} />
                <p style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: current.tagColor, textTransform: "uppercase" }}>
                  {current.label}
                </p>
              </div>

              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(24px,3vw,38px)", fontWeight: 700, color: "#fff", marginBottom: 16, lineHeight: 1.2 }}>
                {current.title}
              </h3>
              <p style={{ fontSize: 16, lineHeight: 1.8, color: C.GREEN_PALE, opacity: 0.7, marginBottom: 28, maxWidth: 480 }}>
                {current.desc}
              </p>

              {/* Fact pills */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 40 }}>
                {current.facts.map(f => (
                  <span key={f} style={{ background: "rgba(64,176,112,0.08)", border: "1px solid rgba(64,176,112,0.2)", color: C.GREEN_PALE, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600 }}>
                    ✓ {f}
                  </span>
                ))}
              </div>

              {/* Nav */}
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button onClick={() => goTo((step - 1 + STEPS.length) % STEPS.length)}
                  style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.6)", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.GREEN; e.currentTarget.style.color = C.GREEN; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}>
                  ←
                </button>

                {/* Dot indicators */}
                <div style={{ display: "flex", gap: 8 }}>
                  {STEPS.map((_, i) => (
                    <button key={i} onClick={() => goTo(i)} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i === step ? C.GREEN : "rgba(255,255,255,0.15)", border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0 }} />
                  ))}
                </div>

                <button onClick={() => goTo((step + 1) % STEPS.length)}
                  style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(64,176,112,0.12)", border: `1px solid rgba(64,176,112,0.3)`, color: C.GREEN, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontFamily: "inherit" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(64,176,112,0.22)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(64,176,112,0.12)"; }}>
                  →
                </button>

                <button onClick={() => setPaused(p => !p)}
                  style={{ padding: "10px 18px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}>
                  {paused ? "▶ Play" : "⏸ Pause"}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom CTA */}
        <div style={{ textAlign: "center", marginTop: 64, paddingTop: 48, borderTop: "1px solid rgba(64,176,112,0.12)" }}>
          <p style={{ fontSize: 18, color: C.GREEN_PALE, opacity: 0.7, marginBottom: 24 }}>
            Ready to scan your own space?
          </p>
          <a href="/?start=scan" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, color: "#fff", fontWeight: 700, fontSize: 16, padding: "14px 32px", borderRadius: 999, textDecoration: "none", boxShadow: `0 4px 24px rgba(64,176,112,0.25)` }}>
            📷 Try Free — No Account Needed
          </a>
        </div>
      </div>
    </section>
  );
}

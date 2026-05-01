import { useState } from "react";

/* ════════════════════════════════════════════════════════════
   HEATWISE — 3-slide intro carousel
   Shown once on first visit; skipped on return.
════════════════════════════════════════════════════════════ */

/* ── Slide 1 visual: city heat illustration ───────────────── */
const CityHeatVisual = () => (
  <div style={{ position: "relative", width: 260, height: 200, margin: "0 auto" }}>
    {[
      { l: 10,  w: 40, h: 90,  c: "rgba(244,132,95,0.85)",  top: 110 },
      { l: 58,  w: 55, h: 130, c: "rgba(230,57,70,0.9)",    top: 70  },
      { l: 121, w: 45, h: 100, c: "rgba(244,132,95,0.75)",  top: 100 },
      { l: 174, w: 60, h: 80,  c: "rgba(249,199,79,0.7)",   top: 120 },
    ].map((b, i) => (
      <div key={i} style={{
        position: "absolute", left: b.l, top: b.top,
        width: b.w, height: b.h,
        background: b.c, borderRadius: "4px 4px 0 0",
        boxShadow: `0 0 24px ${b.c}`,
      }}>
        {[0,1,2].map(r => [0,1].map(c2 => (
          <div key={`${r}-${c2}`} style={{
            position: "absolute",
            top: 8 + r * 20, left: 6 + c2 * 16,
            width: 10, height: 12,
            background: "rgba(255,255,255,0.25)", borderRadius: 2,
          }} />
        )))}
      </div>
    ))}
    <div style={{
      position: "absolute", top: 30, left: 40, right: 40, bottom: 0,
      background: "radial-gradient(ellipse at 50% 30%,rgba(230,57,70,0.35) 0%,transparent 70%)",
      filter: "blur(18px)", pointerEvents: "none",
    }} />
    <div style={{
      position: "absolute", top: 10, right: 20,
      background: "rgba(230,57,70,0.9)", borderRadius: 20, padding: "6px 14px",
      display: "flex", alignItems: "center", gap: 6,
      boxShadow: "0 4px 16px rgba(230,57,70,0.5)",
    }}>
      <span style={{ fontSize: 16 }}>🌡</span>
      <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>+4.2°C</span>
    </div>
    <div style={{
      position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
      borderRadius: 20, padding: "4px 12px",
      fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)",
      letterSpacing: 1.5, whiteSpace: "nowrap",
    }}>URBAN HEAT ISLAND</div>
  </div>
);

/* ── Slide 2 visual: real photo in a phone frame ──────────── */
const ScanPhoneVisual = () => (
  <div style={{ position: "relative", width: 280, height: 210, margin: "0 auto" }}>
    <style>{`
      @keyframes scanLine2{0%,100%{top:12%}50%{top:80%}}
    `}</style>

    {/* floating chips — LEFT */}
    <div style={{ position: "absolute", left: 0, top: "20%", display: "flex", flexDirection: "column", gap: 8 }}>
      {[
        { icon: "📍", text: "Pune, India",  bg: "rgba(56,189,248,0.22)" },
        { icon: "💧", text: "32% humid",   bg: "rgba(56,189,248,0.18)" },
      ].map((c, i) => (
        <div key={i} style={{
          background: c.bg, border: "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(10px)", borderRadius: 20, padding: "5px 10px",
          fontSize: 10, fontWeight: 700, color: "#fff",
          whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
        }}><span>{c.icon}</span>{c.text}</div>
      ))}
    </div>

    {/* floating chips — RIGHT */}
    <div style={{ position: "absolute", right: 0, top: "30%", display: "flex", flexDirection: "column", gap: 8 }}>
      {[
        { icon: "🌡", text: "Hot zone",  bg: "rgba(244,132,95,0.25)" },
        { icon: "☀️", text: "Full sun",  bg: "rgba(249,199,79,0.22)" },
      ].map((c, i) => (
        <div key={i} style={{
          background: c.bg, border: "1px solid rgba(255,255,255,0.22)",
          backdropFilter: "blur(10px)", borderRadius: 20, padding: "5px 10px",
          fontSize: 10, fontWeight: 700, color: "#fff",
          whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
        }}><span>{c.icon}</span>{c.text}</div>
      ))}
    </div>

    {/* Phone frame — centred, photo at near-native size */}
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: "translate(-50%,-50%)",
      width: 110, height: 170,
      border: "3px solid rgba(56,189,248,0.7)",
      borderRadius: 18,
      background: "#000",
      boxShadow: "0 0 28px rgba(56,189,248,0.3), 0 8px 32px rgba(0,0,0,0.5)",
      overflow: "hidden",
    }}>
      {/* real photo — displayed at ~100% of its native aspect inside frame */}
      <img
        src="/intro-garden-1.jpg"
        alt="garden"
        style={{
          width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center",
          display: "block",
        }}
      />
      {/* scan-line overlay */}
      <div style={{
        position: "absolute", left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg,transparent,rgba(56,189,248,0.95),transparent)",
        top: "40%",
        boxShadow: "0 0 8px rgba(56,189,248,0.9)",
        animation: "scanLine2 2s ease-in-out infinite",
      }} />
      {/* corner brackets */}
      {[
        { top: 6, left: 6, borderTop: "2px solid #38BDF8", borderLeft: "2px solid #38BDF8" },
        { top: 6, right: 6, borderTop: "2px solid #38BDF8", borderRight: "2px solid #38BDF8" },
        { bottom: 6, left: 6, borderBottom: "2px solid #38BDF8", borderLeft: "2px solid #38BDF8" },
        { bottom: 6, right: 6, borderBottom: "2px solid #38BDF8", borderRight: "2px solid #38BDF8" },
      ].map((s, i) => (
        <div key={i} style={{ position: "absolute", width: 14, height: 14, ...s }} />
      ))}
    </div>
  </div>
);

/* ── Slide 3 visual: real GIF in a result card ────────────── */
const GardenPlanVisual = () => (
  <div style={{ position: "relative", width: 280, height: 220, margin: "0 auto" }}>

    {/* Result card with photo */}
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: "translate(-50%,-50%)",
      width: 160, height: 190,
      borderRadius: 20,
      overflow: "hidden",
      boxShadow: "0 8px 36px rgba(0,0,0,0.55), 0 0 0 1.5px rgba(82,183,136,0.4)",
    }}>
      <img
        src="/intro-garden-2.gif"
        alt="garden plan"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {/* bottom label overlay */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "linear-gradient(transparent,rgba(0,0,0,0.75))",
        padding: "18px 10px 10px",
        display: "flex", flexDirection: "column", gap: 3,
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#74C69D", letterSpacing: 1.2, textTransform: "uppercase" }}>AI Layout</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>Your Garden Plan</span>
      </div>
    </div>

    {/* AI badge — top right */}
    <div style={{
      position: "absolute", top: 8, right: 12,
      background: "linear-gradient(135deg,#2D6A4F,#52B788)",
      borderRadius: 20, padding: "6px 12px",
      display: "flex", alignItems: "center", gap: 5,
      boxShadow: "0 4px 14px rgba(45,106,79,0.5)",
    }}>
      <span style={{ fontSize: 13 }}>🤖</span>
      <span style={{ fontSize: 10, fontWeight: 800, color: "#fff" }}>AI Ready</span>
    </div>

    {/* cooling badge — bottom left */}
    <div style={{
      position: "absolute", bottom: 8, left: 12,
      background: "rgba(82,183,136,0.22)",
      border: "1px solid rgba(82,183,136,0.55)",
      backdropFilter: "blur(10px)",
      borderRadius: 20, padding: "6px 12px",
      fontSize: 11, fontWeight: 700, color: "#74C69D",
      whiteSpace: "nowrap",
    }}>🌡 −3.8°C cooling</div>

    {/* plant chips — left side */}
    <div style={{ position: "absolute", left: 4, top: "30%", display: "flex", flexDirection: "column", gap: 6 }}>
      {["🌿 Vetiver","🌴 Areca","🎋 Bamboo"].map((p, i) => (
        <div key={i} style={{
          background: "rgba(82,183,136,0.18)", border: "1px solid rgba(82,183,136,0.3)",
          backdropFilter: "blur(8px)", borderRadius: 20, padding: "4px 9px",
          fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.80)", whiteSpace: "nowrap",
        }}>{p}</div>
      ))}
    </div>
  </div>
);

const SLIDES = [
  {
    bg:     "linear-gradient(160deg,#0A1628 0%,#0F2A1E 60%,#1B4332 100%)",
    accent: "#52B788",
    tag:    "URBAN HEAT PROBLEM",
    title:  "Your rooftop is\nhotter than you think",
    body:   "City rooftops trap heat and push urban temperatures 3–5°C above green areas. HeatWise shows you exactly where the heat is — and how to beat it.",
    visual: <CityHeatVisual />,
  },
  {
    bg:     "linear-gradient(160deg,#061220 0%,#0D2137 60%,#143A2D 100%)",
    accent: "#38BDF8",
    tag:    "SMART DETECTION",
    title:  "Scan your space,\nwe detect your climate",
    body:   "Point your camera at any rooftop, terrace or balcony. HeatWise measures the space, detects your local heat zone, and selects the best plants for your exact conditions.",
    visual: <ScanPhoneVisual />,
  },
  {
    bg:     "linear-gradient(160deg,#071524 0%,#0F2D1A 55%,#1B4332 100%)",
    accent: "#74C69D",
    tag:    "AI GARDEN PLAN",
    title:  "Get a personalised\nplant plan in minutes",
    body:   "Choose your goals — cooling, food, privacy or beauty. HeatWise AI picks the right species, arranges your garden layout, and connects you with local installers.",
    visual: <GardenPlanVisual />,
  },
];

export function IntroSlides({ onDone }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  const next = () => { if (isLast) { onDone(); } else setIdx(i => i + 1); };
  const skip = () => onDone();

  return (
    <div style={{
      height: "100%", width: "100%",
      background: slide.bg,
      display: "flex", flexDirection: "column",
      fontFamily: "'DM Sans','Inter','Helvetica Neue',sans-serif",
      transition: "background 0.5s ease",
      position: "relative", overflow: "hidden",
    }}>
      {/* decorative orbs */}
      <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: `rgba(${idx===1?"56,189,248":"82,183,136"},0.07)`, filter: "blur(30px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(82,183,136,0.05)", filter: "blur(24px)", pointerEvents: "none" }} />

      {/* Skip */}
      <div style={{ padding: "calc(env(safe-area-inset-top,44px) + 16px) 24px 0", display: "flex", justifyContent: "flex-end", position: "relative", zIndex: 10 }}>
        {!isLast && (
          <button onClick={skip} style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.60)" }}>
            Skip
          </button>
        )}
      </div>

      {/* Visual */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative", zIndex: 2 }}>
        {slide.visual}
      </div>

      {/* Text content */}
      <div style={{ padding: "0 28px 32px", position: "relative", zIndex: 2 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
          color: slide.accent, marginBottom: 12,
          textTransform: "uppercase",
          fontFamily: "'JetBrains Mono','DM Mono',monospace",
        }}>
          {String(idx + 1).padStart(2, "0")} — {slide.tag}
        </div>

        <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 14, letterSpacing: -0.5, whiteSpace: "pre-line" }}>
          {slide.title}
        </div>

        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.60)", lineHeight: 1.65, marginBottom: 32 }}>
          {slide.body}
        </div>

        {/* Dot indicators */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, justifyContent: "center" }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} style={{
              width: i === idx ? 24 : 8, height: 8,
              borderRadius: 4, border: "none", cursor: "pointer",
              background: i === idx ? slide.accent : "rgba(255,255,255,0.22)",
              transition: "all 0.3s ease", padding: 0,
            }} />
          ))}
        </div>

        {/* CTA */}
        <button onClick={next} style={{
          width: "100%", padding: "16px 0",
          borderRadius: 16, border: "none",
          background: isLast
            ? "linear-gradient(135deg,#2D6A4F,#52B788)"
            : "rgba(255,255,255,0.12)",
          backdropFilter: !isLast ? "blur(8px)" : undefined,
          cursor: "pointer",
          fontSize: 15, fontWeight: 800, color: "#fff",
          letterSpacing: 0.3,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: isLast ? "0 6px 24px rgba(45,106,79,0.5)" : "none",
          transition: "all 0.3s ease",
          border: isLast ? "none" : "1.5px solid rgba(255,255,255,0.22)",
        }}>
          {isLast ? (<><span style={{ fontSize: 18 }}>📷</span> Scan with us →</>) : (<>Next  ›</>)}
        </button>
      </div>
    </div>
  );
}

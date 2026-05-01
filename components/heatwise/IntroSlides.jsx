import { useState } from "react";

/* ════════════════════════════════════════════════════════════
   HEATWISE — 3-slide intro carousel
   Shown once on first visit; skipped on return.
════════════════════════════════════════════════════════════ */

const SLIDES = [
  {
    bg:     "linear-gradient(160deg,#0A1628 0%,#0F2A1E 60%,#1B4332 100%)",
    accent: "#52B788",
    tag:    "URBAN HEAT PROBLEM",
    title:  "Your rooftop is\nhotter than you think",
    body:   "City rooftops trap heat and push urban temperatures 3–5°C above green areas. HeatWise shows you exactly where the heat is — and how to beat it.",
    image:  null, // slide 1 uses CSS illustration
    visual: (
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
            background: b.c,
            borderRadius: "4px 4px 0 0",
            boxShadow: `0 0 24px ${b.c}`,
          }}>
            {[0,1,2].map(r => [0,1].map(c2 => (
              <div key={`${r}-${c2}`} style={{
                position: "absolute",
                top: 8 + r * 20, left: 6 + c2 * 16,
                width: 10, height: 12,
                background: "rgba(255,255,255,0.25)",
                borderRadius: 2,
              }} />
            )))}
          </div>
        ))}
        <div style={{
          position: "absolute", top: 30, left: 40, right: 40, bottom: 0,
          background: "radial-gradient(ellipse at 50% 30%,rgba(230,57,70,0.35) 0%,transparent 70%)",
          filter: "blur(18px)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: 10, right: 20,
          background: "rgba(230,57,70,0.9)",
          borderRadius: 20, padding: "6px 14px",
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
    ),
  },
  {
    bg:     "linear-gradient(180deg,#071e12 0%,#0a2e18 40%,#071e12 100%)",
    accent: "#74C69D",
    tag:    "SMART DETECTION",
    title:  "Scan your space,\nwe detect your climate",
    body:   "Point your camera at any rooftop, terrace or balcony. HeatWise measures the space, detects your local heat zone, and selects the best plants for your exact conditions.",
    image:  "/intro-garden-1.jpg",
    visual: null, // slide 2 uses real garden photo
  },
  {
    bg:     "linear-gradient(180deg,#050f08 0%,#0c2614 40%,#050f08 100%)",
    accent: "#74C69D",
    tag:    "AI GARDEN PLAN",
    title:  "Get a personalised\nplant plan in minutes",
    body:   "Choose your goals — cooling, food, privacy or beauty. HeatWise AI picks the right species, arranges your garden layout, and connects you with local installers.",
    image:  "/intro-garden-2.gif",
    visual: null, // slide 3 uses real garden photo
  },
];

export function IntroSlides({ onDone }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];
  const isLast = idx === SLIDES.length - 1;

  const next = () => {
    if (isLast) { onDone(); }
    else setIdx(i => i + 1);
  };
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
      {/* ── Decorative orbs (CSS slides only) ─────────────────────────── */}
      {!slide.image && <>
        <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(82,183,136,0.07)", filter: "blur(30px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -40, left: -40, width: 160, height: 160, borderRadius: "50%", background: "rgba(82,183,136,0.05)", filter: "blur(24px)", pointerEvents: "none" }} />
      </>}

      {/* ── Full-bleed photo for slides 2 & 3 ────────────────────────── */}
      {slide.image && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${slide.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          zIndex: 0,
        }}>
          {/* gradient overlay for readability */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.18) 38%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.92) 100%)",
          }} />
        </div>
      )}

      {/* ── Skip button ───────────────────────────────────────────────── */}
      <div style={{ padding: "calc(env(safe-area-inset-top,44px) + 16px) 24px 0", display: "flex", justifyContent: "flex-end", position: "relative", zIndex: 10 }}>
        {!isLast && (
          <button onClick={skip} style={{ background: "rgba(255,255,255,0.13)", border: "1px solid rgba(255,255,255,0.22)", borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>
            Skip
          </button>
        )}
      </div>

      {/* ── Visual area ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px", position: "relative", zIndex: 2 }}>
        {slide.visual && slide.visual}

        {/* Photo slides: floating stat chips */}
        {slide.image && idx === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end", position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)" }}>
            {[
              { icon: "📍", text: "Pune, India",    bg: "rgba(56,189,248,0.25)" },
              { icon: "🌡", text: "Hot zone",        bg: "rgba(244,132,95,0.28)" },
              { icon: "💧", text: "32% humidity",   bg: "rgba(56,189,248,0.22)" },
              { icon: "☀️", text: "Full sun",        bg: "rgba(249,199,79,0.25)" },
            ].map((c, i) => (
              <div key={i} style={{
                background: c.bg,
                border: "1px solid rgba(255,255,255,0.2)",
                backdropFilter: "blur(10px)",
                borderRadius: 20, padding: "6px 12px",
                fontSize: 11, fontWeight: 700, color: "#fff",
                whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <span>{c.icon}</span>{c.text}
              </div>
            ))}
          </div>
        )}

        {slide.image && idx === 2 && (
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{
              background: "linear-gradient(135deg,rgba(45,106,79,0.85),rgba(82,183,136,0.85))",
              backdropFilter: "blur(12px)",
              borderRadius: 20, padding: "8px 20px",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 20px rgba(45,106,79,0.5)",
              border: "1px solid rgba(82,183,136,0.5)",
            }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>AI Layout Ready</span>
            </div>
            <div style={{
              background: "rgba(82,183,136,0.25)",
              backdropFilter: "blur(12px)",
              border: "1px solid rgba(82,183,136,0.55)",
              borderRadius: 20, padding: "7px 18px",
              fontSize: 13, fontWeight: 700, color: "#74C69D",
              whiteSpace: "nowrap",
            }}>🌡 −3.8°C estimated cooling</div>
          </div>
        )}
      </div>

      {/* ── Text content ──────────────────────────────────────────────── */}
      <div style={{ padding: "0 28px 32px", position: "relative", zIndex: 2 }}>
        {/* Tag */}
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
          color: slide.accent, marginBottom: 12,
          textTransform: "uppercase",
          fontFamily: "'JetBrains Mono','DM Mono',monospace",
        }}>
          {String(idx + 1).padStart(2, "0")} — {slide.tag}
        </div>

        {/* Title */}
        <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 14, letterSpacing: -0.5, whiteSpace: "pre-line" }}>
          {slide.title}
        </div>

        {/* Body */}
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", lineHeight: 1.65, marginBottom: 28 }}>
          {slide.body}
        </div>

        {/* Dot indicators */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, justifyContent: "center" }}>
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} style={{
              width: i === idx ? 24 : 8, height: 8,
              borderRadius: 4, border: "none", cursor: "pointer",
              background: i === idx ? slide.accent : "rgba(255,255,255,0.25)",
              transition: "all 0.3s ease", padding: 0,
            }} />
          ))}
        </div>

        {/* CTA button */}
        <button onClick={next} style={{
          width: "100%", padding: "16px 0",
          borderRadius: 16, border: "none",
          background: isLast
            ? "linear-gradient(135deg,#2D6A4F,#52B788)"
            : "rgba(255,255,255,0.12)",
          backdropFilter: !isLast ? "blur(8px)" : undefined,
          cursor: "pointer",
          fontSize: 15, fontWeight: 800,
          color: "#fff",
          letterSpacing: 0.3,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          boxShadow: isLast ? "0 6px 24px rgba(45,106,79,0.5)" : "none",
          transition: "all 0.3s ease",
          border: isLast ? "none" : "1.5px solid rgba(255,255,255,0.25)",
        }}>
          {isLast ? (
            <><span style={{ fontSize: 18 }}>📷</span> Scan with us →</>
          ) : (
            <>Next  ›</>
          )}
        </button>
      </div>
    </div>
  );
}

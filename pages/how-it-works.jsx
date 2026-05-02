import MarketingLayout from "@/components/marketing/MarketingLayout";
import { useState, useEffect, useRef } from "react";

const APP = "/app";

function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function FadeUp({ children, delay = 0, style = {} }) {
  const [ref, visible] = useInView();
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(32px)", transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`, ...style }}>
      {children}
    </div>
  );
}

const steps = [
  {
    n: "01",
    icon: "📍",
    title: "Tell us your city",
    subtitle: "30 seconds",
    desc: "Enter your city or allow location access. HeatWise fetches real-time temperature, humidity, wind speed, and sun angle for your exact microclimate — no guessing.",
    detail: ["Current heat index & feels-like temp", "Local wind direction + speed", "AQI & UV index", "Monsoon forecast integration"],
    color: "#52B788",
    glow: "rgba(82,183,136,0.25)",
  },
  {
    n: "02",
    icon: "📷",
    title: "Scan your space",
    subtitle: "2 minutes",
    desc: "Point your camera at the area you want to green — terrace, balcony, courtyard, office corridor, or entire rooftop. Our AI maps surface type, sun exposure, and available volume.",
    detail: ["Surface type detection (concrete, terrace, soil)", "Sun exposure mapping (full / partial / shade)", "Space volume estimation", "Obstacle & drainage detection"],
    color: "#38BDF8",
    glow: "rgba(56,189,248,0.25)",
  },
  {
    n: "03",
    icon: "🌿",
    title: "Get your cooling plan",
    subtitle: "Instant",
    desc: "AI cross-references your scan with 200+ climate-matched plant species. You get a ranked layout showing exactly which plants to place where, and what cooling effect to expect.",
    detail: ["Species ranked by your microclimate", "Projected °C reduction per layout zone", "3D placement preview", "Estimated water & maintenance cost"],
    color: "#A78BFA",
    glow: "rgba(167,139,250,0.25)",
  },
  {
    n: "04",
    icon: "🏗️",
    title: "Connect with installers",
    subtitle: "Optional",
    desc: "Approve the plan and connect with verified green-installation partners in your city. Track progress, get photos, and measure real temperature drop post-installation.",
    detail: ["Verified installer network across 20+ cities", "Transparent quote comparison", "Progress photo updates", "Post-install temperature measurement"],
    color: "#FB923C",
    glow: "rgba(251,146,60,0.25)",
  },
];

function StepCard({ step, index }) {
  const [ref, visible] = useInView(0.1);
  const [hovered, setHovered] = useState(false);
  return (
    <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(40px)",
        transition: `opacity 0.7s ease ${index * 0.15}s, transform 0.7s ease ${index * 0.15}s`,
        background: hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${hovered ? step.color + "55" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 24, padding: "36px 32px",
        boxShadow: hovered ? `0 20px 60px ${step.glow}` : "none",
        transition: `all 0.35s ease, opacity 0.7s ease ${index * 0.15}s, transform 0.7s ease ${index * 0.15}s`,
        cursor: "default",
      }}>
      {/* Step number + icon */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: `linear-gradient(135deg, ${step.color}22, ${step.color}44)`,
          border: `1px solid ${step.color}55`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          boxShadow: `0 4px 20px ${step.glow}`,
        }}>{step.icon}</div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: step.color, letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace", marginBottom: 2 }}>STEP {step.n}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono',monospace" }}>{step.subtitle}</div>
        </div>
      </div>

      <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12, letterSpacing: -0.5 }}>{step.title}</h3>
      <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginBottom: 24 }}>{step.desc}</p>

      {/* Detail list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {step.detail.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: step.color, flexShrink: 0, boxShadow: `0 0 8px ${step.color}` }} />
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.60)" }}>{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const faqs = [
  { q: "Do I need any special equipment to scan my space?", a: "No. Any smartphone camera works. The AI uses computer vision to detect surface type, size, and sun exposure from your photos." },
  { q: "How accurate is the cooling prediction?", a: "Our models are calibrated against 2,400+ real-world green installations. Predicted °C reduction has a mean error of ±0.4°C in field validation." },
  { q: "Which cities does HeatWise support?", a: "Anywhere with Open-Meteo weather data — which covers all of India and 180+ countries. Installer connections are live in 20+ Indian cities and growing." },
  { q: "Can I use HeatWise for a commercial building?", a: "Yes. The Society & Enterprise plans are designed for bulk scans across multiple floors, common areas, and managed reporting for RWAs and developers." },
  { q: "What happens to my scan photos?", a: "Photos are processed ephemerally for space detection and are not stored on our servers. Analysis results are saved to your account, not raw images." },
];

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {faqs.map((f, i) => (
        <FadeUp key={i} delay={i * 0.08}>
          <div onClick={() => setOpen(open === i ? null : i)}
            style={{
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              padding: "20px 0", cursor: "pointer",
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: open === i ? "#74C69D" : "#fff" }}>{f.q}</span>
              <span style={{ fontSize: 20, color: "rgba(255,255,255,0.30)", flexShrink: 0, transform: open === i ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}>+</span>
            </div>
            {open === i && (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.75, marginTop: 12 }}>{f.a}</p>
            )}
          </div>
        </FadeUp>
      ))}
    </div>
  );
}

export default function HowItWorks() {
  return (
    <MarketingLayout title="How HeatWise Works — AI Urban Greening in 4 Steps" description="Scan your space, get AI-matched plant recommendations, and watch your urban heat island cool down. Here's exactly how it works.">
      <div style={{ paddingTop: 100 }}>

        {/* Hero */}
        <section style={{ padding: "80px 24px 60px", textAlign: "center" }}>
          <FadeUp>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(82,183,136,0.12)", border: "1px solid rgba(82,183,136,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 24 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#52B788", letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace" }}>HOW IT WORKS</span>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 style={{ fontSize: "clamp(36px,6vw,64px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, marginBottom: 20, fontFamily: "'Space Grotesk',sans-serif" }}>
              From scan to cool —<br /><span style={{ background: "linear-gradient(135deg,#52B788,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>in under 5 minutes</span>
            </h1>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p style={{ fontSize: 18, color: "rgba(255,255,255,0.55)", maxWidth: 540, margin: "0 auto 40px", lineHeight: 1.7 }}>
              No consultants. No guesswork. Just point your camera and let AI do the rest.
            </p>
          </FadeUp>
          <FadeUp delay={0.3}>
            <a href={`${APP}?start=scan`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg,#1B4332,#52B788)",
              color: "#fff", padding: "14px 28px", borderRadius: 14,
              fontWeight: 800, fontSize: 15, textDecoration: "none",
              boxShadow: "0 8px 32px rgba(82,183,136,0.4)",
            }}>📷 Try it free</a>
          </FadeUp>
        </section>

        {/* Steps grid */}
        <section style={{ padding: "60px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>
            {steps.map((step, i) => <StepCard key={i} step={step} index={i} />)}
          </div>
        </section>

        {/* Visual timeline connector on desktop */}
        <section style={{ padding: "40px 24px 80px", textAlign: "center" }}>
          <FadeUp>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 0, flexWrap: "wrap", justifyContent: "center", gap: 4 }}>
              {["📍 Scan", "→", "🌿 Plan", "→", "📊 Predict", "→", "🏗️ Install"].map((s, i) => (
                <span key={i} style={{ fontSize: i % 2 === 0 ? 14 : 20, fontWeight: i % 2 === 0 ? 700 : 400, color: i % 2 === 0 ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.2)", padding: i % 2 === 0 ? "8px 16px" : "0 8px", background: i % 2 === 0 ? "rgba(255,255,255,0.05)" : "transparent", borderRadius: 8 }}>{s}</span>
              ))}
            </div>
          </FadeUp>
        </section>

        {/* Tech behind it */}
        <section style={{ padding: "80px 24px", background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <FadeUp style={{ textAlign: "center", marginBottom: 60 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace", marginBottom: 16 }}>THE TECHNOLOGY</div>
              <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: -1 }}>What's running under the hood</h2>
            </FadeUp>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20 }}>
              {[
                { icon: "🛰️", title: "Open-Meteo API", desc: "Real-time climate data for 180+ countries — temperature, humidity, UV, wind." },
                { icon: "🤖", title: "Vision AI", desc: "Computer vision model trained on 50k+ space scans to detect surface type and sun exposure." },
                { icon: "🌱", title: "Species Engine", desc: "200+ species scored across 14 trait axes: heat tolerance, water need, canopy density, root depth." },
                { icon: "📐", title: "Layout Optimizer", desc: "Rule-based + ML hybrid that generates optimal placement for maximum cooling per m²." },
                { icon: "🌡️", title: "Thermal Model", desc: "Calibrated heat reduction model validated against 2,400+ real green installation sites." },
                { icon: "🔒", title: "Privacy First", desc: "Scan photos processed ephemerally — never stored. Analysis data encrypted at rest." },
              ].map((t, i) => (
                <FadeUp key={i} delay={i * 0.08}>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 24 }}>
                    <div style={{ fontSize: 28, marginBottom: 12 }}>{t.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{t.title}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.65 }}>{t.desc}</div>
                  </div>
                </FadeUp>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: "80px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <FadeUp style={{ textAlign: "center", marginBottom: 60 }}>
              <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: -1 }}>Frequently asked questions</h2>
            </FadeUp>
            <FAQ />
          </div>
        </section>

        {/* Bottom CTA */}
        <section style={{ padding: "80px 24px", textAlign: "center", background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(82,183,136,0.08) 0%, transparent 70%)" }}>
          <FadeUp>
            <h2 style={{ fontSize: "clamp(28px,4vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: -1, marginBottom: 16 }}>Ready to cool your space?</h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.50)", marginBottom: 32 }}>Free scan. No account required to get started.</p>
            <a href={`${APP}?start=scan`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg,#1B4332,#52B788)",
              color: "#fff", padding: "16px 36px", borderRadius: 14,
              fontWeight: 800, fontSize: 16, textDecoration: "none",
              boxShadow: "0 8px 40px rgba(82,183,136,0.4)",
            }}>📷 Start free scan →</a>
          </FadeUp>
        </section>

      </div>
    </MarketingLayout>
  );
}

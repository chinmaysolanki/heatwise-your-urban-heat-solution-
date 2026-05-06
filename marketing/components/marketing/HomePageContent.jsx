import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import MarketingLayout from "./MarketingLayout";
import { APP_URL } from "../../lib/config";

const C = {
  CREAM: "#fafaf6",
  FOREST: "#1a3828",
  FOREST_MID: "#2a5c3e",
  FOREST_LT: "#3d8a58",
  GREEN: "#40b070",
  GREEN_PALE: "#7dcc9a",
  MINT: "#e0f5e8",
  SKY: "#4a8fc8",
  GOLD: "#c8a440",
  HEAT_RED: "#d83030",
  HEAT_ORANGE: "#d87040",
  BG_DARK: "#111e18",
  BG_MID: "#182a20",
};

function SectionLabel({ children, light }) {
  return (
    <p style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
      fontWeight: 500,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: light ? C.GREEN_PALE : C.GREEN,
      marginBottom: 12,
    }}>
      {children}
    </p>
  );
}

function GreenBtn({ children, href, size = "md" }) {
  const [hov, setHov] = useState(false);
  const pad = size === "lg" ? "16px 36px" : "12px 28px";
  const fs = size === "lg" ? 17 : 15;
  return (
    <Link href={href} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        background: hov ? `linear-gradient(135deg, ${C.FOREST_MID}, ${C.GREEN})` : `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`,
        color: "#fff", fontWeight: 700, fontSize: fs, padding: pad, borderRadius: 999,
        transition: "all 0.3s", textDecoration: "none", whiteSpace: "nowrap",
        animation: "pulse-glow 2.4s ease-in-out infinite",
      }}>
      {children}
    </Link>
  );
}

function GhostBtn({ children, href, size = "md", light }) {
  const [hov, setHov] = useState(false);
  const pad = size === "lg" ? "16px 36px" : "12px 28px";
  const fs = size === "lg" ? 17 : 15;
  return (
    <Link href={href} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        border: `2px solid ${light ? C.GREEN_PALE : C.GREEN}`,
        color: light ? C.GREEN_PALE : C.FOREST_MID, fontWeight: 700, fontSize: fs,
        padding: pad, borderRadius: 999, transition: "all 0.3s", textDecoration: "none",
        background: hov ? (light ? "rgba(64,176,112,0.15)" : C.MINT) : "transparent",
        whiteSpace: "nowrap",
      }}>
      {children}
    </Link>
  );
}

function CountUp({ target, suffix = "" }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        let start = 0;
        const step = (ts) => {
          if (!start) start = ts;
          const progress = Math.min((ts - start) / 1500, 1);
          setVal(Math.floor(progress * target));
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);
  return <span ref={ref}>{val}{suffix}</span>;
}

function HeroSection() {
  const words = "Turn urban heat into a living green canopy".split(" ");
  const gradientWords = ["living", "green"];
  return (
    <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", overflow: "hidden", background: C.CREAM }}>
      <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 800, height: 600, background: `radial-gradient(ellipse, ${C.MINT} 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: 100, left: -100, width: 400, height: 400, background: `radial-gradient(circle, rgba(64,176,112,0.15) 0%, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 100, right: -80, width: 350, height: 350, background: `radial-gradient(circle, rgba(216,112,64,0.08) 0%, transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }} />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px", width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="hero-grid">
        <style>{`@media (max-width: 768px) { .hero-grid { grid-template-columns: 1fr !important; gap: 40px !important; } .hero-card-wrap { display: none !important; } }`}</style>
        <div>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.MINT, border: `1px solid rgba(64,176,112,0.3)`, borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: 600, color: C.FOREST_MID, marginBottom: 24 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.GREEN, animation: "pulse-glow 1.5s ease-in-out infinite" }} />
            AI-Powered Urban Cooling · Now in Early Access
          </motion.div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(36px, 5vw, 60px)", fontWeight: 700, lineHeight: 1.1, marginBottom: 24, color: C.FOREST }}>
            {words.map((word, i) => (
              <motion.span key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, duration: 0.4 }}
                style={{ display: "inline-block", marginRight: "0.28em", ...(gradientWords.includes(word) ? { background: `linear-gradient(135deg, ${C.FOREST_MID}, ${C.GREEN})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" } : {}) }}>
                {word}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.5 }}
            style={{ fontSize: 18, lineHeight: 1.7, color: C.FOREST, opacity: 0.72, marginBottom: 36, maxWidth: 480 }}>
            AI-matched plants. Climate-aware layouts. Real cooling — measured in degrees. Transform any rooftop, balcony or terrace in minutes.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.5 }}
            style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 40 }}>
            <GreenBtn href={APP_URL} size="lg">📷 Scan My Space</GreenBtn>
            <GhostBtn href="/how-it-works" size="lg">▶ Watch 90s Demo</GhostBtn>
          </motion.div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.5 }}
            style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {["Free to start", "No credit card", "Works on any device"].map((badge) => (
              <span key={badge} style={{ fontSize: 13, fontWeight: 600, color: C.FOREST_MID, opacity: 0.8, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: C.GREEN }}>✓</span> {badge}
              </span>
            ))}
          </motion.div>
        </div>
        <motion.div className="hero-card-wrap" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.6 }} style={{ position: "relative" }}>
          <div style={{ aspectRatio: "4/5", borderRadius: 32, background: `linear-gradient(160deg, ${C.MINT} 0%, rgba(64,176,112,0.2) 50%, rgba(42,92,62,0.3) 100%)`, border: `1px solid rgba(64,176,112,0.2)`, overflow: "hidden", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 40, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, padding: 32, opacity: 0.7 }}>
              {["🌿","🪴","🌱","🍃","🌾","🌻","🌵","🪴","🌿","🍃","🌱","🌾"].map((e, i) => (
                <span key={i} style={{ animation: `bob ${3 + (i % 3) * 0.5}s ease-in-out infinite`, animationDelay: `${i * 0.1}s` }}>{e}</span>
              ))}
            </div>
            <div style={{ position: "absolute", top: 20, left: 20, background: "rgba(216,48,48,0.9)", color: "#fff", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", backdropFilter: "blur(8px)" }}>
              URBAN HEAT · BEFORE
            </div>
            <div style={{ position: "absolute", bottom: 20, right: 20, background: "rgba(64,176,112,0.9)", color: "#fff", borderRadius: 999, padding: "6px 14px", fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", backdropFilter: "blur(8px)" }}>
              AFTER GREENING · COOLER
            </div>
          </div>
          <div style={{ position: "absolute", top: 40, right: -24, background: C.BG_DARK, color: C.GREEN_PALE, borderRadius: 16, padding: "12px 18px", fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", boxShadow: "0 8px 32px rgba(0,0,0,0.2)", animation: "bob 4s ease-in-out infinite" }}>
            Cooler 🌿
            <p style={{ fontSize: 11, fontWeight: 400, opacity: 0.7, marginTop: 2 }}>after greening</p>
          </div>
          <div style={{ position: "absolute", bottom: 60, left: -24, background: C.MINT, color: C.FOREST_MID, borderRadius: 16, padding: "12px 18px", fontSize: 13, fontWeight: 700, boxShadow: "0 8px 32px rgba(64,176,112,0.2)", animation: "bob 4s ease-in-out infinite", animationDelay: "0.5s", border: `1px solid rgba(64,176,112,0.2)` }}>
            🤖 AI in minutes
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function MarqueeSection() {
  const items = ["AR Space Scanning","AI Species Matching","Climate Data","Cooling Score","Plant Care Guides","Installer Network","Garden Layout AI","Urban Heat Maps","800+ Species","Rooftop Greening","AR Space Scanning","AI Species Matching","Climate Data","Cooling Score","Plant Care Guides","Installer Network"];
  return (
    <div style={{ borderTop: `1px solid rgba(26,56,40,0.1)`, borderBottom: `1px solid rgba(26,56,40,0.1)`, overflow: "hidden", padding: "16px 0", background: C.CREAM }}>
      <div style={{ display: "flex", gap: 0, animation: "marquee 32s linear infinite", width: "max-content" }}>
        {items.map((item, i) => (
          <span key={i} style={{ padding: "0 40px", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, color: C.FOREST, opacity: 0.5, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
            {item}<span style={{ marginLeft: 40, opacity: 0.3 }}>·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ProblemSection() {
  return (
    <section style={{ padding: "100px 24px", background: C.CREAM }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
          <SectionLabel>01 — The Problem</SectionLabel>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, color: C.FOREST, marginBottom: 56, lineHeight: 1.15 }}>
            The heat crisis{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.HEAT_RED}, ${C.HEAT_ORANGE})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>is real.</span>
          </h2>
        </motion.div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }} className="problem-grid">
          <style>{`@media (max-width: 768px) { .problem-grid { grid-template-columns: 1fr !important; } }`}</style>
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            style={{ background: `radial-gradient(ellipse at 30% 30%, rgba(216,112,64,0.3) 0%, ${C.BG_DARK} 60%)`, borderRadius: 24, padding: 40, color: "#fff" }}>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, opacity: 0.6, marginBottom: 16 }}>SURFACE TEMP · DELHI NCR</p>
            <div style={{ fontSize: "clamp(48px,8vw,80px)", fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", color: C.HEAT_RED, lineHeight: 1, marginBottom: 8 }}>42.7°C</div>
            <p style={{ opacity: 0.6, fontSize: 14, marginBottom: 32 }}>urban surface temperature right now</p>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 60 }}>
              {[30,42,50,65,80,95,100,88,72].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: i > 5 ? `linear-gradient(180deg, ${C.HEAT_RED}, ${C.HEAT_ORANGE})` : "rgba(255,255,255,0.2)", borderRadius: "3px 3px 0 0" }} />
              ))}
            </div>
            <p style={{ fontSize: 11, opacity: 0.4, marginTop: 8, fontFamily: "'JetBrains Mono',monospace" }}>2016 → 2026 · urban heat index</p>
          </motion.div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { val: 5, suffix: "°C", label: "Urban areas are up to 5°C hotter than surrounding rural land", color: C.HEAT_RED },
              { val: 8, suffix: "%", label: "Peak energy demand increase per degree of urban warming", color: C.HEAT_ORANGE },
              { val: 72, suffix: "%", label: "Indians live in cities — directly exposed to urban heat", color: C.GOLD },
            ].map((stat, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                style={{ background: "#fff", borderRadius: 20, padding: "24px 28px", display: "flex", alignItems: "center", gap: 20, boxShadow: "0 2px 16px rgba(26,56,40,0.06)", border: `1px solid rgba(26,56,40,0.06)` }}>
                <div style={{ fontSize: "clamp(28px,4vw,40px)", fontWeight: 700, fontFamily: "'Space Grotesk',sans-serif", color: stat.color, minWidth: 80 }}>
                  <CountUp target={stat.val} suffix={stat.suffix} />
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.5, color: C.FOREST, opacity: 0.75 }}>{stat.label}</p>
              </motion.div>
            ))}
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4, duration: 0.5 }}
              style={{ background: `linear-gradient(135deg, ${C.HEAT_RED}18, ${C.HEAT_ORANGE}18)`, border: `1px solid ${C.HEAT_ORANGE}40`, borderLeft: `4px solid ${C.HEAT_RED}`, borderRadius: 16, padding: "20px 24px" }}>
              <p style={{ fontSize: 22, fontWeight: 700, color: C.HEAT_RED, fontFamily: "'Space Grotesk',sans-serif" }}>"50°C by 2040"</p>
              <p style={{ fontSize: 13, color: C.FOREST, opacity: 0.7, marginTop: 6 }}>— National Action Plan on Climate Change (NAPCC), India</p>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      num: "01", title: "Scan & Measure",
      desc: "Point your phone camera at any rooftop, balcony or terrace. Our AR engine maps dimensions, sunlight exposure and surface materials in under 60 seconds.",
      visual: (
        <div style={{ background: C.BG_DARK, borderRadius: 24, padding: 32, position: "relative", overflow: "hidden", minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 140, height: 260, border: `3px solid ${C.GREEN_PALE}40`, borderRadius: 24, background: "rgba(64,176,112,0.08)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 40 }}>📷</div>
            <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.GREEN}, transparent)`, animation: "scanLine 2s ease-in-out infinite", boxShadow: `0 0 8px ${C.GREEN}` }} />
          </div>
          <div style={{ position: "absolute", top: 16, right: 16, background: `${C.GREEN}22`, border: `1px solid ${C.GREEN}44`, color: C.GREEN_PALE, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>AR · ACTIVE</div>
        </div>
      ),
    },
    {
      num: "02", title: "Detect Your Climate",
      desc: "We pull live weather, UV, humidity and wind data for your exact microclimate — then cross-reference against historical climate patterns to build your plant compatibility profile.",
      visual: (
        <div style={{ background: C.BG_DARK, borderRadius: 24, padding: 32, minHeight: 280, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignContent: "center" }}>
          {[{ label: "Temp", val: "38.2°C", icon: "🌡️", color: C.HEAT_ORANGE }, { label: "UV Index", val: "9.4", icon: "☀️", color: C.GOLD }, { label: "Humidity", val: "58%", icon: "💧", color: C.SKY }, { label: "Wind", val: "12 km/h", icon: "💨", color: C.GREEN_PALE }].map((d, i) => (
            <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.4 }}
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 16, color: "#fff" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{d.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: d.color, fontFamily: "'Space Grotesk',sans-serif" }}>{d.val}</div>
              <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{d.label}</div>
            </motion.div>
          ))}
        </div>
      ),
    },
    {
      num: "03", title: "Get Your AI Garden Plan",
      desc: "Our recommendation engine matches 800+ verified species to your climate profile. You get a printable layout with exact plant positions, watering schedules and expected cooling impact.",
      visual: (
        <div style={{ background: "#fff", borderRadius: 24, padding: 32, minHeight: 280, display: "flex", flexDirection: "column", gap: 16, boxShadow: "0 4px 32px rgba(26,56,40,0.08)", border: `1px solid rgba(64,176,112,0.15)` }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {["🌿","🪴","🌱","🍃","🌾","🌻","🌵","🪴","🌿"].map((e, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05, duration: 0.3 }}
                style={{ aspectRatio: "1", background: C.MINT, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                {e}
              </motion.div>
            ))}
          </div>
          <div style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, color: "#fff", borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Expected cooling</span>
            <span style={{ fontWeight: 800, fontSize: 20, fontFamily: "'Space Grotesk',sans-serif" }}>−3.8°C</span>
          </div>
        </div>
      ),
    },
  ];
  return (
    <section style={{ padding: "100px 24px", background: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 72 }}>
          <SectionLabel>02 — How It Works</SectionLabel>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: C.FOREST, lineHeight: 1.15 }}>
            Three steps to a{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>cooler space</span>
          </h2>
        </motion.div>
        <div style={{ display: "flex", flexDirection: "column", gap: 80 }}>
          {steps.map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
              style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center", direction: i % 2 === 1 ? "rtl" : "ltr" }} className="step-grid">
              <style>{`@media (max-width: 768px) { .step-grid { grid-template-columns: 1fr !important; direction: ltr !important; } }`}</style>
              <div style={{ direction: "ltr" }}>
                <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 72, fontWeight: 800, color: C.MINT, lineHeight: 1, marginBottom: -8 }}>{step.num}</div>
                <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, fontWeight: 700, color: C.FOREST, marginBottom: 16 }}>{step.title}</h3>
                <p style={{ fontSize: 16, lineHeight: 1.75, color: C.FOREST, opacity: 0.72 }}>{step.desc}</p>
              </div>
              <div style={{ direction: "ltr" }}>{step.visual}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  const features = [
    { icon: "🌡️", title: "Live Heat Detection", desc: "Real-time surface temperature mapping using satellite + weather station fusion." },
    { icon: "🤖", title: "AI Layout Engine", desc: "Proprietary recommendation engine optimised for Indian climate zones and rooftop conditions." },
    { icon: "❄️", title: "Cooling Impact Score", desc: "Precise before/after predictions — we're transparent about what each plant will do." },
    { icon: "🌿", title: "800+ Verified Species", desc: "Every plant tagged by climate zone, sun tolerance, water need and cooling efficiency." },
    { icon: "🔨", title: "Installer Network", desc: "Vetted green-thumb pros across Indian cities who can execute your plan end-to-end." },
    { icon: "📱", title: "Works on Any Device", desc: "Browser-based AR scanner works on iOS, Android and desktop — no app required." },
  ];
  return (
    <section style={{ padding: "100px 24px", background: C.CREAM }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 64 }}>
          <SectionLabel>03 — Capabilities</SectionLabel>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: C.FOREST }}>
            Everything your{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>garden</span>{" "}needs
          </h2>
        </motion.div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }} className="feat-grid">
          <style>{`@media (max-width: 900px) { .feat-grid { grid-template-columns: repeat(2,1fr) !important; } } @media (max-width: 600px) { .feat-grid { grid-template-columns: 1fr !important; } }`}</style>
          {features.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.4 }}
              whileHover={{ y: -6, boxShadow: "0 12px 40px rgba(64,176,112,0.15)" }}
              style={{ background: "#fff", border: `1px solid rgba(26,56,40,0.08)`, borderRadius: 20, padding: "32px 28px", boxShadow: "0 2px 12px rgba(26,56,40,0.05)", transition: "box-shadow 0.3s" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.MINT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 20 }}>{f.icon}</div>
              <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 17, color: C.FOREST, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: C.FOREST, opacity: 0.68 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BeforeAfterSection() {
  const [dragX, setDragX] = useState(50);
  const containerRef = useRef(null);
  const dragging = useRef(false);
  const handleMove = (clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDragX(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  };
  return (
    <section style={{ padding: "100px 24px", background: "#fff" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionLabel>04 — Real Results</SectionLabel>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: C.FOREST }}>
            Before & after,{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>drag to compare</span>
          </h2>
        </motion.div>
        <div ref={containerRef} style={{ position: "relative", borderRadius: 24, overflow: "hidden", aspectRatio: "16/7", cursor: "col-resize", userSelect: "none", boxShadow: "0 8px 40px rgba(26,56,40,0.12)" }}
          onMouseDown={() => (dragging.current = true)} onMouseUp={() => (dragging.current = false)} onMouseLeave={() => (dragging.current = false)}
          onMouseMove={(e) => dragging.current && handleMove(e.clientX)} onTouchMove={(e) => handleMove(e.touches[0].clientX)}>
          <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 40% 40%, rgba(64,176,112,0.5) 0%, rgba(26,56,40,0.8) 100%)`, display: "flex", flexWrap: "wrap", alignContent: "center", justifyContent: "center", gap: 8, padding: 24 }}>
            {Array.from({ length: 40 }).map((_, i) => (<span key={i} style={{ fontSize: 20, animation: `bob ${2 + (i % 5) * 0.4}s ease-in-out infinite`, animationDelay: `${i * 0.07}s` }}>{["🌿","🪴","🌱","🍃","🌾"][i % 5]}</span>))}
            <div style={{ position: "absolute", top: 16, left: 16, background: "rgba(64,176,112,0.9)", color: "#fff", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>AFTER</div>
          </div>
          <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - dragX}% 0 0)`, background: `radial-gradient(ellipse at 60% 40%, rgba(216,112,64,0.6) 0%, rgba(17,30,24,0.9) 100%)` }}>
            <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(216,48,48,0.9)", color: "#fff", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>BEFORE</div>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", color: C.HEAT_RED, fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 48, opacity: 0.8 }}>44°C</div>
          </div>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${dragX}%`, width: 3, background: "#fff", boxShadow: "0 0 12px rgba(255,255,255,0.8)" }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 36, height: 36, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", fontSize: 16 }}>⇔</div>
          </div>
        </div>
        <p style={{ textAlign: "center", marginTop: 24, fontSize: 14, color: C.FOREST, opacity: 0.5, fontFamily: "'JetBrains Mono',monospace" }}>
          Drag the slider to compare. Your results will depend on your space, species selection and local climate.
        </p>
      </div>
    </section>
  );
}

const SPECIES_DATA = [
  { emoji: "🌿", name: "Tulsi", sci: "Ocimum tenuiflorum", score: 78, tags: ["Herb", "Pet Safe"] },
  { emoji: "🪴", name: "Snake Plant", sci: "Sansevieria trifasciata", score: 92, tags: ["Succulent", "Shade"] },
  { emoji: "🍃", name: "Curry Leaf", sci: "Murraya koenigii", score: 85, tags: ["Shrub", "Tropical"] },
  { emoji: "🌾", name: "Lemongrass", sci: "Cymbopogon citratus", score: 81, tags: ["Herb", "Drought OK"] },
  { emoji: "🪴", name: "Money Plant", sci: "Epipremnum aureum", score: 88, tags: ["Climber", "Shade"] },
  { emoji: "🌳", name: "Neem", sci: "Azadirachta indica", score: 96, tags: ["Tree", "Drought OK"] },
  { emoji: "🌵", name: "Aloe Vera", sci: "Aloe barbadensis", score: 73, tags: ["Succulent", "Pet Safe"] },
  { emoji: "🌻", name: "Marigold", sci: "Tagetes erecta", score: 65, tags: ["Herb", "Full Sun"] },
];

function SpeciesSection() {
  const doubled = [...SPECIES_DATA, ...SPECIES_DATA];
  return (
    <section style={{ padding: "100px 0", background: C.CREAM, overflow: "hidden" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", marginBottom: 48 }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
          <SectionLabel>05 — Species</SectionLabel>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: C.FOREST }}>
            800+ plants.{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>One perfect match.</span>
          </h2>
        </motion.div>
      </div>
      <div style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 20, padding: "8px 0", animation: "marquee 32s linear infinite", width: "max-content" }}>
          {doubled.map((s, i) => (
            <div key={i} style={{ background: "#fff", border: `1px solid rgba(26,56,40,0.08)`, borderRadius: 20, padding: "24px 20px", width: 200, flexShrink: 0, boxShadow: "0 2px 12px rgba(26,56,40,0.05)" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{s.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.FOREST, marginBottom: 4 }}>{s.name}</div>
              <div style={{ fontSize: 11, fontStyle: "italic", color: C.FOREST, opacity: 0.5, marginBottom: 12 }}>{s.sci}</div>
              <div style={{ background: C.MINT, borderRadius: 999, height: 6, marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: `linear-gradient(90deg, ${C.GREEN}, ${C.FOREST_LT})`, borderRadius: 999 }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, color: C.FOREST, opacity: 0.5 }}>Match score</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.FOREST_LT }}>{s.score}</span>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {s.tags.map((t) => (<span key={t} style={{ background: C.MINT, color: C.FOREST_MID, borderRadius: 999, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{t}</span>))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 40 }}>
        <GhostBtn href="/species">Browse Full Catalog →</GhostBtn>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section style={{ padding: "100px 24px", background: "#fff" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: 48 }}>
          <SectionLabel>06 — Early Access</SectionLabel>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: C.FOREST, marginBottom: 20 }}>
            Be among the{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>first to green</span>
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: C.FOREST, opacity: 0.7, maxWidth: 560, margin: "0 auto 40px" }}>
            HeatWise is launching in select Indian cities. Join early access and help us shape the product — your feedback directly influences what we build next.
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15, duration: 0.5 }}
          style={{ background: `linear-gradient(135deg, ${C.MINT}, rgba(64,176,112,0.1))`, border: `1px solid rgba(64,176,112,0.25)`, borderRadius: 24, padding: "48px 40px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: C.FOREST, marginBottom: 12 }}>Early Access Perks</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400, margin: "0 auto 32px", textAlign: "left" }}>
            {["Free scan & AI layout plan", "Priority onboarding support", "Shape the product roadmap", "Locked-in early adopter pricing"].map((perk) => (
              <div key={perk} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15, color: C.FOREST }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: C.GREEN, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0 }}>✓</span>
                {perk}
              </div>
            ))}
          </div>
          <GreenBtn href={APP_URL} size="lg">📷 Get Early Access</GreenBtn>
        </motion.div>
      </div>
    </section>
  );
}

const CITIES = [
  { name: "Delhi", temp: 46.2, x: 42, y: 22 },
  { name: "Mumbai", temp: 42.7, x: 28, y: 52 },
  { name: "Kolkata", temp: 41.8, x: 72, y: 38 },
  { name: "Chennai", temp: 43.4, x: 56, y: 75 },
  { name: "Bengaluru", temp: 39.6, x: 48, y: 72 },
  { name: "Hyderabad", temp: 44.1, x: 50, y: 62 },
  { name: "Ahmedabad", temp: 45.8, x: 28, y: 35 },
  { name: "Jaipur", temp: 44.9, x: 38, y: 24 },
  { name: "Pune", temp: 41.2, x: 34, y: 56 },
  { name: "Lucknow", temp: 43.7, x: 55, y: 28 },
  { name: "Surat", temp: 42.3, x: 27, y: 44 },
  { name: "Kochi", temp: 36.4, x: 43, y: 85 },
];

function tempColor(t) {
  if (t >= 45) return C.HEAT_RED;
  if (t >= 42) return C.HEAT_ORANGE;
  if (t >= 39) return C.GOLD;
  return C.GREEN;
}

function HeatMapSection() {
  const [tooltip, setTooltip] = useState(null);
  const [scanY, setScanY] = useState(0);
  useEffect(() => {
    let frame; let start;
    const animate = (ts) => {
      if (!start) start = ts;
      setScanY(((ts - start) % 6000) / 6000 * 100);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <section style={{ padding: "100px 24px", background: C.BG_DARK, color: "#fff" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionLabel light>07 — Live coverage</SectionLabel>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700 }}>
            India's{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.HEAT_ORANGE}, ${C.HEAT_RED})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>surface heat</span>{" "}in real time
          </h2>
        </motion.div>
        <div style={{ background: C.BG_MID, borderRadius: 24, overflow: "hidden", border: `1px solid rgba(64,176,112,0.15)`, position: "relative" }}>
          <div style={{ background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(64,176,112,0.2)", padding: "10px 20px", display: "flex", alignItems: "center", gap: 20, fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.HEAT_RED, animation: "pulse-glow 1.5s ease-in-out infinite" }} />
              <span style={{ color: C.HEAT_RED }}>LIVE</span>
            </span>
            <span style={{ opacity: 0.6 }}>MODIS LST</span>
            <span style={{ opacity: 0.6 }}>RES 1KM</span>
            <span style={{ marginLeft: "auto", opacity: 0.4 }}>Updated: {new Date().toLocaleTimeString()}</span>
          </div>
          <div style={{ position: "relative", padding: "24px 24px 16px" }}>
            <svg viewBox="0 0 100 120" style={{ width: "100%", maxHeight: 440, display: "block" }} preserveAspectRatio="xMidYMid meet">
              <path d="M30 8 L42 5 L55 7 L65 10 L75 18 L78 28 L76 36 L80 44 L76 52 L72 58 L68 64 L62 72 L60 80 L56 86 L50 92 L44 96 L40 92 L36 84 L30 76 L24 68 L20 58 L18 48 L20 38 L22 28 L26 18 Z"
                fill="rgba(64,176,112,0.08)" stroke="rgba(64,176,112,0.3)" strokeWidth="0.8" />
              <line x1="15" y1={scanY * 1.1} x2="85" y2={scanY * 1.1} stroke={C.GREEN} strokeWidth="0.5" opacity="0.6" strokeDasharray="2,3" />
              {CITIES.map((city) => {
                const col = tempColor(city.temp);
                return (
                  <g key={city.name} style={{ cursor: "pointer" }} onMouseEnter={() => setTooltip(city)} onMouseLeave={() => setTooltip(null)}>
                    <circle cx={city.x} cy={city.y} r="2.5" fill={col} opacity="0.3" />
                    <circle cx={city.x} cy={city.y} r="1.5" fill={col} />
                    <circle cx={city.x} cy={city.y} r="0.7" fill="#fff" />
                    <text x={city.x + 2.5} y={city.y - 2.5} fontSize="2.5" fill="#fff" opacity="0.7" fontFamily="DM Sans, sans-serif">{city.name}</text>
                  </g>
                );
              })}
              <text x="88" y="12" fontSize="3" fill="rgba(255,255,255,0.4)" fontFamily="monospace">N↑</text>
            </svg>
            <AnimatePresence>
              {tooltip && (
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                  style={{ position: "absolute", top: "30%", right: 40, background: "rgba(17,30,24,0.95)", border: `1px solid ${tempColor(tooltip.temp)}44`, borderRadius: 12, padding: "12px 16px", fontSize: 13, backdropFilter: "blur(12px)", zIndex: 10, minWidth: 160 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4 }}>{tooltip.name}</p>
                  <p style={{ color: tempColor(tooltip.temp), fontWeight: 700, fontSize: 18, fontFamily: "'Space Grotesk',sans-serif" }}>{tooltip.temp}°C</p>
                  <p style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>surface temperature</p>
                </motion.div>
              )}
            </AnimatePresence>
            <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
              {[{ label: "≥45°C", color: C.HEAT_RED }, { label: "≥42°C", color: C.HEAT_ORANGE }, { label: "≥39°C", color: C.GOLD }, { label: "<39°C", color: C.GREEN }].map((l) => (
                <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: 0.8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.color, display: "inline-block" }} />{l.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24, marginTop: 32 }} className="stats-grid">
          <style>{`@media (max-width: 600px) { .stats-grid { grid-template-columns: 1fr !important; } }`}</style>
          {[{ val: "800+", label: "Verified species" }, { val: "5°C", label: "Max urban heat gap" }, { val: "60s", label: "Time to scan" }].map((s) => (
            <div key={s.label} style={{ textAlign: "center", padding: 24, background: "rgba(255,255,255,0.04)", borderRadius: 16, border: "1px solid rgba(64,176,112,0.1)" }}>
              <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 28, fontWeight: 700, color: C.GREEN_PALE }}>{s.val}</div>
              <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const [annual, setAnnual] = useState(false);
  const tiers = [
    { emoji: "🌱", name: "Starter", tagline: "Explore for free", monthly: 0, yearly: 0, cta: "Get Started", ctaHref: APP_URL, popular: false, perks: ["1 space scan", "Basic species match", "3 layout suggestions", "Community support"] },
    { emoji: "🌿", name: "Green", tagline: "For homeowners", monthly: 499, yearly: 399, cta: "Start Free Trial", ctaHref: APP_URL, popular: true, perks: ["Unlimited scans", "Full AI layout plans", "800+ species access", "Cooling score reports", "Email support", "PDF export"] },
    { emoji: "🌳", name: "Pro / Society", tagline: "For buildings & groups", monthly: 2499, yearly: 1999, cta: "Contact Sales", ctaHref: "/contact", popular: false, perks: ["Everything in Green", "Multi-unit management", "Installer coordination", "Custom reports", "API access", "Dedicated support"] },
  ];
  return (
    <section id="pricing" style={{ padding: "100px 24px", background: C.CREAM }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 48 }}>
          <SectionLabel>08 — Pricing</SectionLabel>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: C.FOREST, marginBottom: 32 }}>
            Plant a plan that{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>grows with you</span>
          </h2>
          <div style={{ display: "inline-flex", alignItems: "center", background: C.MINT, borderRadius: 999, padding: 4, gap: 4 }}>
            {["Monthly", "Annual"].map((opt) => {
              const isActive = (opt === "Annual") === annual;
              return (
                <button key={opt} onClick={() => setAnnual(opt === "Annual")}
                  style={{ padding: "8px 20px", borderRadius: 999, fontSize: 14, fontWeight: 600, color: isActive ? "#fff" : C.FOREST_MID, background: isActive ? `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})` : "transparent", transition: "all 0.3s", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                  {opt}{opt === "Annual" && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>−20%</span>}
                </button>
              );
            })}
          </div>
        </motion.div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }} className="pricing-grid">
          <style>{`@media (max-width: 900px) { .pricing-grid { grid-template-columns: 1fr !important; max-width: 420px; margin: 0 auto; } }`}</style>
          {tiers.map((tier, i) => (
            <motion.div key={tier.name} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
              style={{ background: "#fff", borderRadius: 24, padding: "36px 28px", border: tier.popular ? `2px solid ${C.GREEN}` : `1px solid rgba(26,56,40,0.08)`, boxShadow: tier.popular ? `0 8px 40px rgba(64,176,112,0.2)` : "0 2px 16px rgba(26,56,40,0.05)", position: "relative", display: "flex", flexDirection: "column" }}>
              {tier.popular && (<div style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, color: "#fff", fontSize: 12, fontWeight: 700, padding: "4px 16px", borderRadius: 999, whiteSpace: "nowrap" }}>MOST POPULAR</div>)}
              <div style={{ fontSize: 36, marginBottom: 12 }}>{tier.emoji}</div>
              <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: C.FOREST, marginBottom: 4 }}>{tier.name}</h3>
              <p style={{ fontSize: 14, color: C.FOREST, opacity: 0.6, marginBottom: 24 }}>{tier.tagline}</p>
              <AnimatePresence mode="wait">
                <motion.div key={annual ? "annual" : "monthly"} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} style={{ marginBottom: 28 }}>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 40, fontWeight: 800, color: C.FOREST }}>
                    {(annual ? tier.yearly : tier.monthly) === 0 ? "Free" : `₹${annual ? tier.yearly : tier.monthly}`}
                  </span>
                  {(annual ? tier.yearly : tier.monthly) > 0 && <span style={{ fontSize: 14, color: C.FOREST, opacity: 0.5, marginLeft: 4 }}>/mo</span>}
                </motion.div>
              </AnimatePresence>
              <Link href={tier.ctaHref} style={{ display: "block", textAlign: "center", padding: "12px 0", borderRadius: 999, fontWeight: 700, fontSize: 15, background: tier.popular ? `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})` : "transparent", color: tier.popular ? "#fff" : C.FOREST_MID, border: tier.popular ? "none" : `2px solid ${C.GREEN}`, marginBottom: 28, textDecoration: "none", transition: "all 0.3s" }}>{tier.cta}</Link>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                {tier.perks.map((p) => (
                  <li key={p} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: C.FOREST }}>
                    <span style={{ width: 20, height: 20, borderRadius: "50%", background: C.MINT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0, color: C.GREEN, fontWeight: 700 }}>✓</span>{p}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ_ITEMS = [
  { q: "How accurate is the AR scan?", a: "Our AR engine uses your phone's camera and sensors to map dimensions and sunlight exposure. We cross-validate with live GPS microclimate data to build a plant compatibility profile specific to your space." },
  { q: "How does the AI pick species?", a: "Our model considers your exact GPS coordinates, current and historical temperature/humidity/UV, available sunlight hours, surface type, budget and maintenance preference. It runs 800+ species through a compatibility matrix and ranks by cooling efficiency × survival probability." },
  { q: "Do you deliver plants?", a: "We're building out our nursery partner network. During early access, our team will help coordinate sourcing through trusted local suppliers in your city." },
  { q: "Can installers do everything?", a: "Our vetted installers handle soil preparation, container selection, planting, irrigation setup and initial care training. Availability varies by city — contact us to check coverage in your area." },
  { q: "What's the actual cooling impact?", a: "Research shows urban greening can reduce surface temperatures by 3–5°C depending on species density, orientation and local climate. Your personalised Cooling Score report will give you an estimate specific to your space." },
  { q: "Is there a refund policy?", a: "Starter is free — no commitment needed. For paid plans, we'll work with you directly during early access. Reach out to us and we'll make it right." },
  { q: "Do you work with housing societies?", a: "Absolutely. Our Pro/Society plan handles multi-unit projects — entire floors, podium gardens and society compounds. Contact our team for a customised quote and phased implementation plan." },
  { q: "Which cities are supported?", a: "We're in early access and expanding rapidly across Indian metros. Scan your space anywhere — our climate database covers all major Indian cities. Installer and delivery availability will be confirmed after your scan." },
];

function FAQSection({ light }) {
  const [open, setOpen] = useState(null);
  return (
    <section style={{ padding: "100px 24px", background: light ? C.CREAM : "#fff" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 56 }}>
          <SectionLabel>09 — FAQ</SectionLabel>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: C.FOREST }}>
            Questions,{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>answered</span>
          </h2>
        </motion.div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.4 }}>
                <div style={{ background: "#fff", border: `1px solid ${isOpen ? C.GREEN + "44" : "rgba(26,56,40,0.08)"}`, borderRadius: 16, overflow: "hidden", boxShadow: isOpen ? `0 4px 20px rgba(64,176,112,0.08)` : "0 1px 6px rgba(26,56,40,0.04)", transition: "border-color 0.3s, box-shadow 0.3s" }}>
                  <button onClick={() => setOpen(isOpen ? null : i)}
                    style={{ width: "100%", textAlign: "left", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "none", cursor: "pointer", border: "none", fontFamily: "'DM Sans',sans-serif" }}>
                    <span style={{ fontWeight: 600, fontSize: 16, color: C.FOREST, paddingRight: 16 }}>{item.q}</span>
                    <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.2 }} style={{ fontSize: 20, fontWeight: 300, color: C.GREEN, flexShrink: 0, lineHeight: 1 }}>+</motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} style={{ overflow: "hidden" }}>
                        <p style={{ padding: "0 24px 20px", fontSize: 15, lineHeight: 1.75, color: C.FOREST, opacity: 0.75 }}>{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  const particles = Array.from({ length: 40 });
  return (
    <section style={{ position: "relative", padding: "120px 24px", background: C.BG_DARK, overflow: "hidden", textAlign: "center" }}>
      <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: `radial-gradient(ellipse, rgba(64,176,112,0.2) 0%, transparent 70%)`, pointerEvents: "none" }} />
      {particles.map((_, i) => (
        <div key={i} style={{ position: "absolute", width: 4 + (i % 4) * 2, height: 4 + (i % 4) * 2, borderRadius: "50%", background: C.GREEN_PALE, opacity: 0.15 + (i % 5) * 0.08, left: `${(i * 2.5) % 100}%`, top: `${(i * 3.7) % 100}%`, animation: `bob ${3 + (i % 4)}s ease-in-out infinite`, animationDelay: `${(i * 0.12) % 2}s`, pointerEvents: "none" }} />
      ))}
      <div style={{ position: "relative", zIndex: 1 }}>
        <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(32px,5vw,64px)", fontWeight: 800, color: "#fff", marginBottom: 20, lineHeight: 1.1 }}>
          Ready to cool your space?
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1, duration: 0.5 }}
          style={{ fontSize: 18, color: C.GREEN_PALE, opacity: 0.85, marginBottom: 48 }}>
          Scan once. Get a plan. Watch your city breathe.
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2, duration: 0.5 }} style={{ marginBottom: 32 }}>
          <GreenBtn href={APP_URL} size="lg">📷 Start Free Scan →</GreenBtn>
        </motion.div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          {["No credit card", "2-min scan", "Free to start"].map((badge) => (
            <span key={badge} style={{ fontSize: 13, fontWeight: 600, color: C.GREEN_PALE, opacity: 0.7, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: C.GREEN }}>✓</span> {badge}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <MarketingLayout title="HeatWise — AI-Powered Urban Cooling" description="AI-matched plants, climate-aware layouts, real cooling measured in degrees. Transform any rooftop, balcony or terrace in minutes.">
      <HeroSection />
      <MarqueeSection />
      <ProblemSection />
      <HowItWorksSection />
      <CapabilitiesSection />
      <BeforeAfterSection />
      <SpeciesSection />
      <TestimonialsSection />
      <HeatMapSection />
      <PricingSection />
      <FAQSection light />
      <FinalCTA />
    </MarketingLayout>
  );
}

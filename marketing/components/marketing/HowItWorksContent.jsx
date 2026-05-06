import { useState } from "react";
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
    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: light ? C.GREEN_PALE : C.GREEN, marginBottom: 12 }}>
      {children}
    </p>
  );
}

function GreenBtn({ children, href, size = "md" }) {
  const [hov, setHov] = useState(false);
  return (
    <Link href={href} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "inline-flex", alignItems: "center", gap: 8, background: hov ? `linear-gradient(135deg, ${C.FOREST_MID}, ${C.GREEN})` : `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, color: "#fff", fontWeight: 700, fontSize: size === "lg" ? 17 : 15, padding: size === "lg" ? "16px 36px" : "12px 28px", borderRadius: 999, transition: "all 0.3s", textDecoration: "none", whiteSpace: "nowrap" }}>
      {children}
    </Link>
  );
}

const FAQ_ITEMS = [
  { q: "How accurate is the AR scan?", a: "Our AR engine achieves ±8cm dimensional accuracy on most modern smartphones. We cross-validate with GPS microclimate data to build a cooling prediction specific to your space." },
  { q: "What if my plants don't do well?", a: "Our AI selects species with high survival rates for your exact climate — temperature, humidity, UV and seasonal rainfall. If a plant underperforms, your care dashboard will flag it and our support team will help troubleshoot. Reach us at hello@heatwise.in." },
  { q: "How does the AI pick species?", a: "Our model considers your exact GPS coordinates, current and historical temperature/humidity/UV, available sunlight hours, surface type, budget and maintenance preference. It runs 800+ species through a compatibility matrix and ranks by cooling efficiency × survival probability." },
  { q: "Do you deliver plants?", a: "We're building a network of verified nursery partners across Indian cities. Delivery availability varies by location — check during checkout and we'll show you what's available in your area." },
  { q: "Can installers do everything?", a: "Our verified installers handle soil preparation, container selection, planting, irrigation setup and initial care training. They're background-checked and rated by past customers." },
  { q: "What's the actual cooling impact?", a: "Cooling impact depends on plant density, species mix, rooftop orientation and local climate. Scientific research on urban greening consistently shows 2–8°C surface temperature reductions. Your personalised Cooling Score report will give you a space-specific estimate based on your scan data." },
  { q: "Is there a refund policy?", a: "Starter is free. Green and Pro plans offer a 14-day full refund if you're not satisfied — just email us." },
  { q: "Do you work with housing societies?", a: "Absolutely. Our Pro/Society plan handles multi-unit projects — floors, podium gardens and society compounds. Contact our sales team for a customised quote and phased implementation plan." },
];

function FAQAccordion() {
  const [open, setOpen] = useState(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = open === i;
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.04, duration: 0.4 }}>
            <div style={{ background: "#fff", border: `1px solid ${isOpen ? C.GREEN + "44" : "rgba(26,56,40,0.08)"}`, borderRadius: 16, overflow: "hidden", transition: "border-color 0.3s" }}>
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
  );
}

const CLIMATE_POINTS = [
  { icon: "🌡️", label: "Surface Temp", val: "Live MODIS LST satellite data, 1km resolution" },
  { icon: "☀️", label: "UV Index", val: "NASA POWER daily UV flux for your coordinates" },
  { icon: "💧", label: "Humidity", val: "ECMWF ERA5 reanalysis + real-time station data" },
  { icon: "💨", label: "Wind Speed", val: "10m above ground wind vectors, hourly update" },
  { icon: "🌧️", label: "Rainfall", val: "14-year monthly precipitation normals + forecasts" },
  { icon: "🌫️", label: "Air Quality", val: "PM2.5, NO₂ and ozone — affects plant health" },
  { icon: "🏙️", label: "Urban Heat Island", val: "Delta vs rural baseline for your neighbourhood" },
  { icon: "📍", label: "Microclimate", val: "Building shadows, rooftop albedo, surface type" },
  { icon: "📅", label: "Seasonal Rhythm", val: "Growing season start/end, frost risk, dry spells" },
];

export default function HowItWorksPage() {
  const [playDemo, setPlayDemo] = useState(false);

  const steps = [
    {
      num: "01", title: "Scan & Measure",
      desc: "Point your phone camera at any rooftop, balcony or terrace. Our AR engine maps dimensions, sunlight exposure and surface materials in under 60 seconds. Works in browser — no app download needed.",
      visual: (
        <div style={{ background: C.BG_DARK, borderRadius: 24, padding: 32, position: "relative", overflow: "hidden", minHeight: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 140, height: 260, border: `3px solid ${C.GREEN_PALE}40`, borderRadius: 24, background: "rgba(64,176,112,0.08)", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 40 }}>📷</div>
            <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.GREEN}, transparent)`, animation: "scanLine 2s ease-in-out infinite", boxShadow: `0 0 8px ${C.GREEN}` }} />
            <style>{`@keyframes scanLine { 0% { top: 0; opacity: 1; } 95% { opacity: 1; } 100% { top: 100%; opacity: 0; } }`}</style>
          </div>
          <div style={{ position: "absolute", top: 16, right: 16, background: `${C.GREEN}22`, border: `1px solid ${C.GREEN}44`, color: C.GREEN_PALE, borderRadius: 8, padding: "4px 10px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace" }}>AR · ACTIVE</div>
          <div style={{ position: "absolute", bottom: 16, left: 16, color: C.GREEN_PALE, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", opacity: 0.7 }}>2.4m × 3.8m · 9.1m²</div>
        </div>
      ),
    },
    {
      num: "02", title: "Detect Your Climate",
      desc: "We pull live weather, UV, humidity and wind data for your exact microclimate — then cross-reference against 14 years of historical patterns to build a comprehensive plant compatibility profile specific to your space.",
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
      desc: "Our recommendation engine matches 800+ verified species to your climate profile. You receive a printable layout with exact plant positions, container specs, watering schedules, maintenance calendar and expected cooling impact — personalised to your space.",
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
            <span style={{ fontWeight: 700, fontSize: 15 }}>AI-optimised layout</span>
            <span style={{ fontWeight: 800, fontSize: 20, fontFamily: "'Space Grotesk',sans-serif" }}>✓ Ready</span>
          </div>
        </div>
      ),
    },
  ];

  const algorithmCols = [
    { title: "Inputs", color: C.HEAT_ORANGE, items: ["GPS coordinates", "Space dimensions", "Sun exposure hours", "Surface material", "Budget range", "Maintenance level", "User goals"] },
    { title: "Constraints", color: C.GOLD, items: ["Climate zone rules", "Pet safety flags", "Drought tolerance", "Root depth limits", "Load bearing (kg/m²)", "Water availability", "Seasonal window"] },
    { title: "Optimiser", color: C.GREEN, items: ["Compatibility matrix", "Cooling efficiency rank", "Biodiversity score", "Cost-benefit ratio", "Survival probability", "Layout density calc", "Installer availability"] },
    { title: "Output", color: C.SKY, items: ["Plant list + positions", "Container specs", "Watering schedule", "Cooling score", "PDF layout plan", "Installation guide", "Care calendar"] },
  ];

  return (
    <MarketingLayout title="How HeatWise Works — AI-Powered Urban Cooling" description="Learn how HeatWise uses AR scanning, climate data and AI to generate your perfect urban garden plan.">
      <style>{`
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 16px 2px rgba(64,176,112,0.3); } 50% { box-shadow: 0 0 32px 8px rgba(64,176,112,0.6); } }
      `}</style>

      {/* Hero */}
      <section style={{ padding: "80px 24px 60px", background: C.CREAM, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 700, height: 500, background: `radial-gradient(ellipse, ${C.MINT} 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ maxWidth: 800, margin: "0 auto", position: "relative" }}>
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: C.MINT, border: `1px solid rgba(64,176,112,0.3)`, borderRadius: 999, padding: "6px 16px", fontSize: 13, fontWeight: 600, color: C.FOREST_MID, marginBottom: 24 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.GREEN }} />
            3-step process · Under 5 minutes
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.5 }}
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 800, lineHeight: 1.1, color: C.FOREST, marginBottom: 24 }}>
            How HeatWise{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>cools your space</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}
            style={{ fontSize: 18, lineHeight: 1.7, color: C.FOREST, opacity: 0.7, marginBottom: 40, maxWidth: 600, margin: "0 auto 40px" }}>
            From a blank rooftop to a thriving green canopy in three steps — powered by satellite data, AR scanning and a recommendation engine built for Indian climate conditions.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
            <GreenBtn href={APP_URL} size="lg">📷 Try It Free</GreenBtn>
          </motion.div>
        </div>
      </section>

      {/* Demo Video Placeholder */}
      <section style={{ padding: "0 24px 80px", background: C.CREAM }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            onClick={() => setPlayDemo(true)}
            style={{ background: C.BG_DARK, borderRadius: 24, aspectRatio: "16/9", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", cursor: "pointer", boxShadow: "0 16px 64px rgba(0,0,0,0.3)" }}>
            <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 40% 40%, rgba(64,176,112,0.15) 0%, transparent 70%)` }} />
            {!playDemo ? (
              <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
                <motion.div whileHover={{ scale: 1.1 }} style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: `0 0 40px rgba(64,176,112,0.4)` }}>
                  <span style={{ fontSize: 28, marginLeft: 4 }}>▶</span>
                </motion.div>
                <p style={{ color: C.GREEN_PALE, fontWeight: 600, fontSize: 16 }}>Watch 90s Demo</p>
                <p style={{ color: C.GREEN_PALE, opacity: 0.5, fontSize: 13, marginTop: 6 }}>See a full rooftop scan → plan in real time</p>
              </div>
            ) : (
              <div style={{ color: C.GREEN_PALE, fontSize: 16, opacity: 0.7 }}>Demo video would play here</div>
            )}
            <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(216,48,48,0.8)", color: "#fff", borderRadius: 999, padding: "4px 12px", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>
              ● DEMO · 1:32
            </div>
          </motion.div>
        </div>
      </section>

      {/* 3-Step Process */}
      <section style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 72 }}>
            <SectionLabel>The Process</SectionLabel>
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

      {/* Climate API Explainer */}
      <section style={{ padding: "80px 24px", background: C.CREAM }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: 56 }}>
            <SectionLabel>Climate Intelligence</SectionLabel>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(24px,3.5vw,42px)", fontWeight: 700, color: C.FOREST, marginBottom: 16 }}>
              9 data streams.{" "}
              <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>One complete picture.</span>
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: C.FOREST, opacity: 0.7, maxWidth: 560 }}>
              We don't just check the weather. We pull from nine distinct data sources to build a comprehensive microclimate model for your exact location.
            </p>
          </motion.div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }} className="climate-grid">
            <style>{`@media (max-width: 900px) { .climate-grid { grid-template-columns: repeat(2,1fr) !important; } } @media (max-width: 600px) { .climate-grid { grid-template-columns: 1fr !important; } }`}</style>
            {CLIMATE_POINTS.map((pt, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.4 }}
                style={{ background: "#fff", border: `1px solid rgba(26,56,40,0.08)`, borderRadius: 18, padding: "24px 20px", display: "flex", gap: 16, alignItems: "flex-start", boxShadow: "0 2px 12px rgba(26,56,40,0.04)" }}>
                <span style={{ fontSize: 28, flexShrink: 0 }}>{pt.icon}</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: 15, color: C.FOREST, marginBottom: 4 }}>{pt.label}</p>
                  <p style={{ fontSize: 13, lineHeight: 1.6, color: C.FOREST, opacity: 0.6 }}>{pt.val}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Algorithm Diagram */}
      <section style={{ padding: "80px 24px", background: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 56 }}>
            <SectionLabel>Under the Hood</SectionLabel>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(24px,3.5vw,42px)", fontWeight: 700, color: C.FOREST }}>
              The recommendation{" "}
              <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>algorithm</span>
            </h2>
          </motion.div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "stretch" }} className="algo-grid">
            <style>{`@media (max-width: 900px) { .algo-grid { grid-template-columns: repeat(2,1fr) !important; } } @media (max-width: 500px) { .algo-grid { grid-template-columns: 1fr !important; } }`}</style>
            {algorithmCols.map((col, i) => (
              <motion.div key={col.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.5 }}
                style={{ background: C.CREAM, border: `1px solid rgba(26,56,40,0.08)`, borderRadius: 20, overflow: "hidden" }}>
                <div style={{ background: col.color, padding: "16px 20px" }}>
                  <p style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: "#fff" }}>{col.title}</p>
                  {i < 3 && <p style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", fontSize: 20, opacity: 0, pointerEvents: "none" }}>→</p>}
                </div>
                <ul style={{ listStyle: "none", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {col.items.map((item) => (
                    <li key={item} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.FOREST, opacity: 0.8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: col.color, flexShrink: 0, opacity: 0.7 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 24, alignItems: "center", opacity: 0.5, fontSize: 13 }}>
            {algorithmCols.map((col, i) => (
              <>
                <span key={col.title} style={{ color: col.color, fontWeight: 600 }}>{col.title}</span>
                {i < algorithmCols.length - 1 && <span key={`arrow-${i}`} style={{ fontSize: 16 }}>→</span>}
              </>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: "80px 24px", background: C.CREAM }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ textAlign: "center", marginBottom: 56 }}>
            <SectionLabel>FAQ</SectionLabel>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, color: C.FOREST }}>
              Questions,{" "}
              <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>answered</span>
            </h2>
          </motion.div>
          <FAQAccordion />
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ position: "relative", padding: "100px 24px", background: C.BG_DARK, overflow: "hidden", textAlign: "center" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 400, background: `radial-gradient(ellipse, rgba(64,176,112,0.2) 0%, transparent 70%)`, pointerEvents: "none" }} />
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{ position: "absolute", width: 4 + (i % 4) * 2, height: 4 + (i % 4) * 2, borderRadius: "50%", background: C.GREEN_PALE, opacity: 0.12 + (i % 5) * 0.05, left: `${(i * 5) % 100}%`, top: `${(i * 7.3) % 100}%`, animation: `bob ${3 + (i % 4)}s ease-in-out infinite`, animationDelay: `${(i * 0.2) % 2}s`, pointerEvents: "none" }} />
        ))}
        <div style={{ position: "relative", zIndex: 1 }}>
          <motion.h2 initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,56px)", fontWeight: 800, color: "#fff", marginBottom: 16, lineHeight: 1.1 }}>
            Ready to see it in action?
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
            style={{ fontSize: 17, color: C.GREEN_PALE, opacity: 0.8, marginBottom: 40 }}>
            Scan your space for free. Get your AI plan in minutes.
          </motion.p>
          <GreenBtn href={APP_URL} size="lg">📷 Start Free Scan →</GreenBtn>
        </div>
      </section>
    </MarketingLayout>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import MarketingLayout from "@/components/marketing/MarketingLayout";
import InteractiveDemo from "@/components/marketing/InteractiveDemo";

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
  { q: "How accurate is the AR scan?", a: "Our AR engine achieves ±8cm dimensional accuracy on most modern smartphones. We cross-validate with GPS microclimate data to ensure cooling predictions are within ±0.5°C of actual post-installation measurements." },
  { q: "What if my plants die?", a: "Every HeatWise plan comes with a 90-day plant health guarantee. If any plant in your AI-selected plan doesn't thrive within 90 days when following our care schedule, we'll replace it for free — no questions asked." },
  { q: "How does the AI pick species?", a: "Our model considers your exact GPS coordinates, current and historical temperature/humidity/UV, available sunlight hours, surface type, budget and maintenance preference. It runs 800+ species through a compatibility matrix and ranks by cooling efficiency × survival probability." },
  { q: "Do you deliver plants?", a: "Yes — through our network of verified nursery partners in all 14 cities. Delivery typically takes 3–5 business days. All plants are acclimatised to your city's climate zone before dispatch." },
  { q: "Can installers do everything?", a: "Our verified installers handle soil preparation, container selection, planting, irrigation setup and initial care training. They're background-checked, rated by past customers, and carry liability insurance." },
  { q: "What's the actual cooling impact?", a: "Across our 3,250+ installed projects, we've measured an average surface temperature reduction of 4.2°C and a 38% improvement in perceived comfort. Results vary by species density, orientation and city — your Cooling Score report gives you a personalised estimate." },
  { q: "Is there a refund policy?", a: "Starter is free. Green and Pro plans offer a 14-day full refund if you're not satisfied — just email us. Plant delivery refunds follow our nursery partner's standard policy (damage in transit is covered 100%)." },
  { q: "Do you work with housing societies?", a: "Absolutely. Our Pro/Society plan handles multi-unit projects — we've done entire floors, podium gardens and society compounds. Contact our sales team for a customised quote and phased implementation plan." },
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

// ─────────────────────────────────────────────────────────────────────────────
// 👇 PASTE YOUR VIDEO URL HERE WHEN READY
//    Supported: YouTube, Loom, Vimeo, or a direct .mp4 path like "/demo.mp4"
//    Leave as null to keep the interactive demo shown instead.
const DEMO_VIDEO_URL = null;
// Examples:
//   const DEMO_VIDEO_URL = "https://www.youtube.com/watch?v=YOUR_VIDEO_ID";
//   const DEMO_VIDEO_URL = "https://www.loom.com/share/YOUR_LOOM_ID";
//   const DEMO_VIDEO_URL = "https://vimeo.com/YOUR_VIMEO_ID";
//   const DEMO_VIDEO_URL = "/demo.mp4";   ← drop file in /public/demo.mp4
// ─────────────────────────────────────────────────────────────────────────────

function getEmbedUrl(url) {
  if (!url) return null;
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1`;
  // Loom
  const loom = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loom) return `https://www.loom.com/embed/${loom[1]}?autoplay=1`;
  // Vimeo
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;
  // Direct MP4 — handled separately
  return url;
}

function DemoVideoSection() {
  const [playing, setPlaying] = useState(false);
  const embedUrl = getEmbedUrl(DEMO_VIDEO_URL);
  const isDirectVideo = DEMO_VIDEO_URL && (DEMO_VIDEO_URL.endsWith(".mp4") || DEMO_VIDEO_URL.endsWith(".webm"));

  return (
    <section style={{ padding: "0 24px 80px", background: C.CREAM }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ borderRadius: 24, aspectRatio: "16/9", position: "relative", overflow: "hidden", boxShadow: "0 16px 64px rgba(0,0,0,0.2)", background: C.BG_DARK }}>

          {/* ── Video playing ─────────────────────────────────────────────── */}
          {playing && embedUrl && !isDirectVideo && (
            <iframe src={embedUrl} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
              allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
          )}
          {playing && isDirectVideo && (
            <video src={DEMO_VIDEO_URL} autoPlay controls playsInline
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          )}

          {/* ── Thumbnail / play button ────────────────────────────────────── */}
          {!playing && (
            <>
              <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 40% 40%, rgba(64,176,112,0.15) 0%, transparent 70%)` }} />
              <button onClick={() => setPlaying(true)}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, cursor: "pointer", border: "none", background: "transparent" }}>
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.97 }}
                  style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 12px rgba(64,176,112,0.15), 0 0 40px rgba(64,176,112,0.3)` }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: 3 }}>
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </motion.div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: 17, fontFamily: "'Space Grotesk', sans-serif" }}>Watch 90s Demo</p>
                  <p style={{ color: C.GREEN_PALE, opacity: 0.6, fontSize: 13, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>See a full rooftop scan → AI plan in real time</p>
                </div>
              </button>
              <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(216,48,48,0.85)", color: "#fff", borderRadius: 999, padding: "5px 14px", fontSize: 11, fontWeight: 700, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff", animation: "hwBlink 1s ease-in-out infinite" }} />
                DEMO · 1:32
              </div>
              <style>{`@keyframes hwBlink{0%,100%{opacity:1}50%{opacity:.2}}`}</style>
            </>
          )}
        </motion.div>

        {/* Caption */}
        <p style={{ textAlign: "center", fontSize: 13, color: C.FOREST, opacity: 0.45, marginTop: 14, fontFamily: "'JetBrains Mono', monospace" }}>
          No sign-up needed · Recorded on a real balcony in Delhi
        </p>
      </div>
    </section>
  );
}

export default function HowItWorksPage() {
  const [playDemo, setPlayDemo] = useState(false);

  // Reusable phone shell
  const PhoneShell = ({ children, badge }) => (
    <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
      <div style={{ width: 220, background: "#0a0f0a", borderRadius: 36, padding: "10px 10px", boxShadow: "0 32px 64px rgba(0,0,0,0.35), 0 0 0 1.5px rgba(64,176,112,0.2), inset 0 0 0 1px rgba(255,255,255,0.04)" }}>
        {/* notch */}
        <div style={{ height: 22, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 3 }}>
          <div style={{ width: 64, height: 16, background: "#000", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.1)" }} />
          </div>
        </div>
        {/* screen */}
        <div style={{ borderRadius: 24, overflow: "hidden", background: "#04091a" }}>{children}</div>
        {/* home bar */}
        <div style={{ height: 18, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 3 }}>
          <div style={{ width: 60, height: 3, background: "rgba(255,255,255,0.18)", borderRadius: 2 }} />
        </div>
      </div>
      {badge && <div style={{ position: "absolute", top: 24, right: -20, background: `${C.GREEN}22`, border: `1px solid ${C.GREEN}55`, color: C.GREEN_PALE, borderRadius: 8, padding: "4px 10px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap" }}>{badge}</div>}
    </div>
  );

  const steps = [
    {
      num: "01", title: "Scan & Measure",
      desc: "Point your phone camera at any rooftop, balcony or terrace. Our AR engine maps dimensions, sunlight exposure and surface materials in under 60 seconds. Works in browser — no app download needed.",
      visual: (
        <PhoneShell badge="AR · ACTIVE">
          {/* status bar */}
          <div style={{ background: "#0a1a0f", padding: "6px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "monospace" }}>9:41</span>
            <span style={{ fontSize: 9, color: C.GREEN, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>● SCANNING</span>
          </div>
          {/* camera viewfinder */}
          <div style={{ position: "relative", height: 180, background: "linear-gradient(160deg, #1a2e1a 0%, #0d1f0d 100%)", overflow: "hidden" }}>
            {/* grid overlay */}
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(64,176,112,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(64,176,112,0.08) 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
            {/* scan line */}
            <div style={{ position: "absolute", left: 0, right: 0, height: 1.5, background: `linear-gradient(90deg, transparent, ${C.GREEN}, transparent)`, animation: "scanLine 2s ease-in-out infinite", boxShadow: `0 0 10px ${C.GREEN}` }} />
            {/* corner brackets */}
            {[["0","0","right","bottom"],["0","auto","right","auto"],["auto","0","auto","bottom"],["auto","auto","auto","auto"]].map(([t,r,b,l], i) => (
              <div key={i} style={{ position: "absolute", top: t==="0"?12:"auto", right: r==="0"?12:"auto", bottom: b==="0"?12:"auto", left: l==="0"?12:"auto", width: 16, height: 16,
                borderTop: (i<2) ? `2px solid ${C.GREEN}` : "none", borderBottom: (i>=2) ? `2px solid ${C.GREEN}` : "none",
                borderLeft: (i===0||i===2) ? `2px solid ${C.GREEN}` : "none", borderRight: (i===1||i===3) ? `2px solid ${C.GREEN}` : "none" }} />
            ))}
            {/* dimension overlay */}
            <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
              <div style={{ background: "rgba(0,0,0,0.7)", border: `1px solid ${C.GREEN}44`, borderRadius: 6, padding: "3px 10px", fontSize: 10, color: C.GREEN, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                2.4m × 3.8m · 9.1 m²
              </div>
            </div>
            {/* heat zones */}
            <div style={{ position: "absolute", top: 20, left: 20, display: "flex", gap: 5 }}>
              {[["#d83030","44°C"],["#d87040","41°C"],["#40b070","35°C"]].map(([c,t]) => (
                <div key={t} style={{ background: c+"33", border: `1px solid ${c}66`, borderRadius: 5, padding: "2px 6px", fontSize: 8, color: c, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>{t}</div>
              ))}
            </div>
          </div>
          {/* bottom info bar */}
          <div style={{ padding: "10px 14px", background: "#0a1a0f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono',monospace" }}>SURFACE</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginTop: 1 }}>Concrete Rooftop</div>
            </div>
            <div style={{ background: C.GREEN, borderRadius: 8, padding: "6px 12px", fontSize: 10, fontWeight: 800, color: "#fff" }}>Analyse →</div>
          </div>
        </PhoneShell>
      ),
    },
    {
      num: "02", title: "Detect Your Climate",
      desc: "We pull live weather, UV, humidity and wind data for your exact microclimate — then cross-reference against 14 years of historical patterns to build a comprehensive plant compatibility profile specific to your space.",
      visual: (
        <PhoneShell badge="LIVE DATA">
          {/* header */}
          <div style={{ background: "linear-gradient(135deg,#0d1f0d,#1a3828)", padding: "12px 14px 10px" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono',monospace", letterSpacing: 1 }}>YOUR MICROCLIMATE</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginTop: 2 }}>Bengaluru, KA</div>
            <div style={{ fontSize: 9, color: C.GREEN, fontFamily: "'JetBrains Mono',monospace", marginTop: 1 }}>● Updated 2 min ago</div>
          </div>
          {/* climate grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "rgba(255,255,255,0.04)" }}>
            {[
              { icon: "🌡️", label: "Temperature", val: "38.2°C", color: "#d87040", bg: "rgba(216,112,64,0.10)" },
              { icon: "☀️", label: "UV Index",    val: "9.4 / 11", color: "#f5c518", bg: "rgba(245,197,24,0.10)" },
              { icon: "💧", label: "Humidity",    val: "62%",    color: "#38bdf8", bg: "rgba(56,189,248,0.10)" },
              { icon: "💨", label: "Wind Speed",  val: "12 km/h",color: C.GREEN,   bg: "rgba(64,176,112,0.10)" },
            ].map((d, i) => (
              <div key={i} style={{ background: d.bg, padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.04)", borderRight: i%2===0 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                <div style={{ fontSize: 16, marginBottom: 4 }}>{d.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: d.color, fontFamily: "'Space Grotesk',sans-serif" }}>{d.val}</div>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.38)", marginTop: 2 }}>{d.label}</div>
              </div>
            ))}
          </div>
          {/* compatibility bar */}
          <div style={{ padding: "10px 14px", background: "#0a1a0f" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "'JetBrains Mono',monospace" }}>PLANT COMPATIBILITY</span>
              <span style={{ fontSize: 9, color: C.GREEN, fontWeight: 700 }}>847 species match</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4 }}>
              <motion.div initial={{ width: 0 }} whileInView={{ width: "92%" }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.3 }}
                style={{ height: "100%", background: `linear-gradient(90deg,${C.GREEN},#74c69d)`, borderRadius: 4 }} />
            </div>
          </div>
        </PhoneShell>
      ),
    },
    {
      num: "03", title: "Get Your AI Garden Plan",
      desc: "Our recommendation engine matches 800+ verified species to your climate profile. You receive a printable layout with exact plant positions, container specs, watering schedules, maintenance calendar and expected cooling impact — personalised to your space.",
      visual: (
        <PhoneShell badge="AI PLAN READY">
          {/* header */}
          <div style={{ background: "linear-gradient(135deg,#1b4332,#2d6a4f)", padding: "12px 14px 10px" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", fontFamily: "'JetBrains Mono',monospace" }}>YOUR GARDEN PLAN</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>9.1 m² Rooftop</div>
              <div style={{ background: "rgba(64,176,112,0.25)", border: "1px solid rgba(116,198,157,0.4)", borderRadius: 6, padding: "2px 8px", fontSize: 9, color: "#74c69d", fontWeight: 700 }}>−4.2°C</div>
            </div>
          </div>
          {/* plant cards */}
          <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6, background: "#04091a" }}>
            <div style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono',monospace", marginBottom: 2 }}>TOP RECOMMENDATIONS</div>
            {[
              { e: "🌿", name: "Snake Plant",   score: 96, tag: "Low water",  c: C.GREEN },
              { e: "🪴", name: "Neem Tree",     score: 92, tag: "Max cooling", c: "#38bdf8" },
              { e: "🌾", name: "Vetiver Grass", score: 89, tag: "Native",     c: "#f5c518" },
              { e: "🍃", name: "Areca Palm",    score: 85, tag: "Air purify", c: "#a78bfa" },
            ].map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.35 }}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "7px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>{p.e}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#e0f5e8", marginBottom: 3 }}>{p.name}</div>
                  <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${p.score}%`, background: `linear-gradient(90deg,${p.c},${p.c}88)`, borderRadius: 3 }} />
                  </div>
                </div>
                <span style={{ fontSize: 8, color: p.c, fontWeight: 700, background: p.c+"18", border: `1px solid ${p.c}33`, borderRadius: 4, padding: "2px 5px", whiteSpace: "nowrap" }}>{p.tag}</span>
              </motion.div>
            ))}
          </div>
          {/* CTA */}
          <div style={{ padding: "8px 12px 10px", background: "#04091a" }}>
            <div style={{ background: `linear-gradient(135deg,${C.GREEN},#52b788)`, borderRadius: 10, padding: "9px", textAlign: "center", fontSize: 11, fontWeight: 800, color: "#fff" }}>
              Download PDF Plan 📥
            </div>
          </div>
        </PhoneShell>
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
            From a blank rooftop to a thriving green canopy in three steps — powered by satellite data, AR scanning and a recommendation engine trained on 50,000+ Indian rooftops.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}>
            <GreenBtn href="/?start=scan" size="lg">📷 Try It Free</GreenBtn>
          </motion.div>
        </div>
      </section>

      {/* Demo video (or interactive demo when no video URL is set) */}
      {DEMO_VIDEO_URL ? <DemoVideoSection /> : <InteractiveDemo />}

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
          <GreenBtn href="/?start=scan" size="lg">📷 Start Free Scan →</GreenBtn>
        </div>
      </section>
    </MarketingLayout>
  );
}

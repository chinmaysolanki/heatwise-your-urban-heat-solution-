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
  const PhoneShell = ({ children, badge, floatBadge }) => (
    <div style={{ display: "flex", justifyContent: "center", position: "relative" }}>
      <div style={{ width: 240, background: "#0a0f0a", borderRadius: 40, padding: "10px 10px", boxShadow: "0 40px 80px rgba(0,0,0,0.4), 0 0 0 1.5px rgba(64,176,112,0.25), inset 0 0 0 1px rgba(255,255,255,0.05)" }}>
        {/* notch */}
        <div style={{ height: 24, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 3 }}>
          <div style={{ width: 70, height: 18, background: "#000", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.12)" }} />
            <div style={{ width: 11, height: 11, borderRadius: "50%", background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.1)" }} />
          </div>
        </div>
        {/* screen */}
        <div style={{ borderRadius: 28, overflow: "hidden", background: "#04091a" }}>{children}</div>
        {/* home bar */}
        <div style={{ height: 20, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 3 }}>
          <div style={{ width: 64, height: 4, background: "rgba(255,255,255,0.18)", borderRadius: 2 }} />
        </div>
      </div>
      {badge && <div style={{ position: "absolute", top: 20, right: -24, background: `${C.GREEN}22`, border: `1px solid ${C.GREEN}55`, color: C.GREEN_PALE, borderRadius: 8, padding: "5px 12px", fontSize: 10, fontFamily: "'JetBrains Mono',monospace", whiteSpace: "nowrap", backdropFilter: "blur(8px)" }}>{badge}</div>}
      {floatBadge && floatBadge}
    </div>
  );

  const steps = [
    {
      num: "01", title: "Scan & Measure",
      desc: "Point your phone camera at any rooftop, balcony or terrace. Our AR engine maps dimensions, sunlight exposure and surface materials in under 60 seconds. Works in browser — no app download needed.",
      visual: (
        <PhoneShell badge="AR · ACTIVE" floatBadge={
          <motion.div animate={{ y: [0,-8,0] }} transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
            style={{ position:"absolute", bottom: 40, left: -36, background:"#fff", border:"1px solid rgba(216,112,64,0.3)", borderRadius:12, padding:"8px 12px", boxShadow:"0 8px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize:9, color:"#999", marginBottom:2 }}>Surface heat</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#d87040" }}>44°C 🔥</div>
          </motion.div>
        }>
          {/* status bar */}
          <div style={{ background:"#060f06", padding:"7px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:9, color:"rgba(255,255,255,0.45)", fontFamily:"monospace" }}>9:41</span>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#40b070", boxShadow:"0 0 6px #40b070", animation:"pulse-glow 1.5s ease-in-out infinite" }} />
              <span style={{ fontSize:9, color:"#40b070", fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>SCANNING</span>
            </div>
          </div>

          {/* MAIN viewfinder — rooftop heatmap */}
          <div style={{ position:"relative", height:210, overflow:"hidden" }}>
            {/* rooftop base — hot concrete look */}
            <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg, #7a3010 0%, #b84820 30%, #c86030 55%, #a04020 80%, #703010 100%)" }} />
            {/* heat shimmer overlay */}
            <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 60% 35%, rgba(255,120,30,0.45) 0%, transparent 65%), radial-gradient(ellipse at 25% 70%, rgba(200,60,20,0.35) 0%, transparent 50%)", mixBlendMode:"overlay" }} />
            {/* concrete texture lines */}
            <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)", backgroundSize:"28px 28px", opacity:0.6 }} />

            {/* AR measurement box — main focus */}
            <div style={{ position:"absolute", top:24, left:20, right:20, bottom:32, border:"2px solid rgba(64,176,112,0.9)", borderRadius:6, boxShadow:"0 0 0 1px rgba(64,176,112,0.2), inset 0 0 30px rgba(64,176,112,0.05)" }}>
              {/* corner brackets — thicker, more visible */}
              {[[0,0],[0,1],[1,0],[1,1]].map(([r,c], i) => (
                <div key={i} style={{ position:"absolute", top:r ? "auto":-1, bottom:r ? -1:"auto", left:c ? "auto":-1, right:c ? -1:"auto", width:18, height:18,
                  borderTop: !r ? "3px solid #40b070":"none", borderBottom: r ? "3px solid #40b070":"none",
                  borderLeft: !c ? "3px solid #40b070":"none", borderRight: c ? "3px solid #40b070":"none" }} />
              ))}

              {/* width arrow label */}
              <div style={{ position:"absolute", top:-14, left:"50%", transform:"translateX(-50%)", background:"rgba(0,0,0,0.8)", border:"1px solid rgba(64,176,112,0.5)", borderRadius:4, padding:"2px 8px", fontSize:9, color:"#40b070", fontFamily:"'JetBrains Mono',monospace", fontWeight:700, whiteSpace:"nowrap" }}>
                ←— 3.8 m —→
              </div>
              {/* height arrow label */}
              <div style={{ position:"absolute", right:-38, top:"50%", transform:"translateY(-50%)", background:"rgba(0,0,0,0.8)", border:"1px solid rgba(64,176,112,0.5)", borderRadius:4, padding:"2px 7px", fontSize:9, color:"#40b070", fontFamily:"'JetBrains Mono',monospace", fontWeight:700, whiteSpace:"nowrap" }}>
                2.4 m
              </div>

              {/* temperature zones inside */}
              <div style={{ position:"absolute", inset:4, display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gridTemplateRows:"1fr 1fr", gap:2 }}>
                {[["#e05020","44°C"],["#d06030","41°C"],["#c07040","39°C"],["#b08050","38°C"],["#808060","36°C"],["#608060","34°C"]].map(([col,temp],i) => (
                  <div key={i} style={{ background:col+"55", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <span style={{ fontSize:8, fontWeight:800, color:col, fontFamily:"'JetBrains Mono',monospace", textShadow:"0 1px 3px rgba(0,0,0,0.8)" }}>{temp}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* scan line */}
            <div style={{ position:"absolute", left:20, right:20, height:2, background:`linear-gradient(90deg, transparent, #40b070, transparent)`, animation:"scanLine 2.2s ease-in-out infinite", boxShadow:"0 0 12px #40b07099", zIndex:3 }} />

            {/* bottom: area badge */}
            <div style={{ position:"absolute", bottom:6, left:0, right:0, display:"flex", justifyContent:"center", zIndex:4 }}>
              <div style={{ background:"rgba(0,0,0,0.85)", border:"1px solid rgba(64,176,112,0.6)", borderRadius:6, padding:"4px 14px", fontSize:10, color:"#74c69d", fontFamily:"'JetBrains Mono',monospace", fontWeight:800, letterSpacing:0.5 }}>
                9.1 m²  ·  Concrete Rooftop
              </div>
            </div>
          </div>

          {/* bottom bar */}
          <div style={{ background:"#060f06", padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:8, color:"rgba(255,255,255,0.3)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 }}>SUN EXPOSURE</div>
              <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:3 }}>
                {["■","■","■","■","□"].map((s,i) => <span key={i} style={{ fontSize:8, color: s==="■" ? "#f5c518" : "rgba(255,255,255,0.15)" }}>{s}</span>)}
                <span style={{ fontSize:9, color:"#f5c518", fontWeight:700, marginLeft:2 }}>High</span>
              </div>
            </div>
            <motion.div whileHover={{ scale:1.05 }} style={{ background:`linear-gradient(135deg,#1b4332,#40b070)`, borderRadius:10, padding:"8px 16px", fontSize:11, fontWeight:800, color:"#fff", cursor:"pointer", boxShadow:"0 4px 14px rgba(64,176,112,0.4)" }}>
              Analyse →
            </motion.div>
          </div>
        </PhoneShell>
      ),
    },
    {
      num: "02", title: "Detect Your Climate",
      desc: "We pull live weather, UV, humidity and wind data for your exact microclimate — then cross-reference against 14 years of historical patterns to build a comprehensive plant compatibility profile specific to your space.",
      visual: (
        <PhoneShell badge="LIVE DATA" floatBadge={
          <motion.div animate={{ y: [0,-8,0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay:0.5 }}
            style={{ position:"absolute", top:40, right:-40, background:"#fff", border:"1px solid rgba(56,189,248,0.3)", borderRadius:12, padding:"8px 12px", boxShadow:"0 8px 24px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize:9, color:"#999", marginBottom:2 }}>Plant matches</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#1b4332" }}>847 🌿</div>
          </motion.div>
        }>
          {/* header */}
          <div style={{ background:"linear-gradient(135deg,#0a1a0f,#1a3828)", padding:"10px 16px 12px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
              <div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", fontFamily:"'JetBrains Mono',monospace", letterSpacing:1 }}>YOUR MICROCLIMATE</div>
                <div style={{ fontSize:16, fontWeight:800, color:"#fff", marginTop:3 }}>Bengaluru, KA</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)" }}>feels like</div>
                <div style={{ fontSize:20, fontWeight:900, color:"#e05020", fontFamily:"'Space Grotesk',sans-serif" }}>42°C</div>
              </div>
            </div>
            {/* mini gauge bar */}
            <div style={{ marginTop:10, height:4, background:"rgba(255,255,255,0.08)", borderRadius:4, overflow:"hidden" }}>
              <motion.div initial={{ width:0 }} whileInView={{ width:"88%" }} viewport={{ once:true }} transition={{ duration:1.2 }}
                style={{ height:"100%", background:"linear-gradient(90deg,#38bdf8,#e05020)", borderRadius:4 }} />
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:3 }}>
              <span style={{ fontSize:8, color:"rgba(255,255,255,0.3)" }}>Cool</span>
              <span style={{ fontSize:8, color:"#e05020", fontWeight:700 }}>Heat index: VERY HIGH</span>
            </div>
          </div>

          {/* 4 climate cards in 2x2 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:"rgba(255,255,255,0.04)" }}>
            {[
              { icon:"🌡️", label:"Temperature", val:"38.2°C", sub:"+4° above avg", color:"#e07040", bg:"rgba(224,112,64,0.12)" },
              { icon:"☀️", label:"UV Index",    val:"9.4",    sub:"Extreme risk", color:"#f5c518", bg:"rgba(245,197,24,0.12)" },
              { icon:"💧", label:"Humidity",    val:"62%",    sub:"Moderate",     color:"#38bdf8", bg:"rgba(56,189,248,0.12)" },
              { icon:"💨", label:"Wind",        val:"12km/h", sub:"South-West",   color:"#74c69d", bg:"rgba(116,198,157,0.12)" },
            ].map((d,i) => (
              <motion.div key={i} initial={{ opacity:0, scale:0.9 }} whileInView={{ opacity:1, scale:1 }} viewport={{ once:true }} transition={{ delay:i*0.1, duration:0.35 }}
                style={{ background:d.bg, padding:"12px 14px", borderBottom:"1px solid rgba(255,255,255,0.04)", borderRight:i%2===0?"1px solid rgba(255,255,255,0.04)":"none" }}>
                <div style={{ fontSize:18, marginBottom:5 }}>{d.icon}</div>
                <div style={{ fontSize:17, fontWeight:900, color:d.color, fontFamily:"'Space Grotesk',sans-serif", lineHeight:1 }}>{d.val}</div>
                <div style={{ fontSize:8, color:"rgba(255,255,255,0.35)", marginTop:3 }}>{d.label}</div>
                <div style={{ fontSize:8, color:d.color, marginTop:2, fontWeight:600 }}>{d.sub}</div>
              </motion.div>
            ))}
          </div>

          {/* compatibility result */}
          <div style={{ background:"#060f06", padding:"10px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontSize:9, color:"rgba(255,255,255,0.4)", fontFamily:"'JetBrains Mono',monospace" }}>SPECIES MATCH SCORE</span>
              <span style={{ fontSize:10, color:C.GREEN, fontWeight:800 }}>92%</span>
            </div>
            <div style={{ height:5, background:"rgba(255,255,255,0.07)", borderRadius:5, overflow:"hidden" }}>
              <motion.div initial={{ width:0 }} whileInView={{ width:"92%" }} viewport={{ once:true }} transition={{ duration:1.4, delay:0.4, ease:"easeOut" }}
                style={{ height:"100%", background:`linear-gradient(90deg,#1b4332,#40b070,#74c69d)`, borderRadius:5 }} />
            </div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,0.3)", marginTop:5 }}>847 of 920 species compatible with your space</div>
          </div>
        </PhoneShell>
      ),
    },
    {
      num: "03", title: "Get Your AI Garden Plan",
      desc: "Our recommendation engine matches 800+ verified species to your climate profile. You receive a printable layout with exact plant positions, container specs, watering schedules, maintenance calendar and expected cooling impact — personalised to your space.",
      visual: (
        <PhoneShell badge="PLAN READY" floatBadge={
          <motion.div animate={{ y: [0,-8,0] }} transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut", delay:1 }}
            style={{ position:"absolute", bottom:50, left:-40, background:"#fff", border:"1px solid rgba(64,176,112,0.3)", borderRadius:12, padding:"8px 12px", boxShadow:"0 8px 24px rgba(0,0,0,0.12)" }}>
            <div style={{ fontSize:9, color:"#999", marginBottom:2 }}>Surface cooling</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#1b4332" }}>−4.2°C 🌿</div>
          </motion.div>
        }>
          {/* header */}
          <div style={{ background:"linear-gradient(135deg,#1b4332,#2d6a4f)", padding:"10px 14px 10px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:9, color:"rgba(255,255,255,0.5)", fontFamily:"'JetBrains Mono',monospace" }}>AI GARDEN PLAN</div>
                <div style={{ fontSize:14, fontWeight:800, color:"#fff", marginTop:2 }}>Your 9.1 m² Rooftop</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:8, color:"rgba(255,255,255,0.4)" }}>expected</div>
                <div style={{ fontSize:20, fontWeight:900, color:"#74c69d", fontFamily:"'Space Grotesk',sans-serif" }}>−4.2°C</div>
              </div>
            </div>
          </div>

          {/* garden layout grid — visual plant map */}
          <div style={{ padding:"10px 12px 6px", background:"#060f06" }}>
            <div style={{ fontSize:8, color:"rgba(255,255,255,0.3)", fontFamily:"'JetBrains Mono',monospace", marginBottom:6 }}>LAYOUT PLAN · TOP VIEW</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gridTemplateRows:"repeat(3,1fr)", gap:3, height:70 }}>
              {[
                "🌿","🪴","🌾","🌿","🍃",
                "🪴","🌱","🌿","🪴","🌾",
                "🌾","🌿","🍃","🌱","🌿",
              ].map((e,i) => (
                <motion.div key={i} initial={{ opacity:0, scale:0 }} whileInView={{ opacity:1, scale:1 }} viewport={{ once:true }} transition={{ delay:i*0.04, duration:0.25 }}
                  style={{ background:"rgba(64,176,112,0.12)", border:"1px solid rgba(64,176,112,0.2)", borderRadius:5, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>
                  {e}
                </motion.div>
              ))}
            </div>
          </div>

          {/* top 3 plants */}
          <div style={{ padding:"6px 12px 6px", background:"#060f06", display:"flex", flexDirection:"column", gap:5 }}>
            {[
              { e:"🌿", name:"Snake Plant",   cooling:"−1.8°C", score:96, c:"#40b070" },
              { e:"🪴", name:"Neem Tree",     cooling:"−1.4°C", score:92, c:"#38bdf8" },
              { e:"🌾", name:"Vetiver Grass", cooling:"−1.0°C", score:89, c:"#f5c518" },
            ].map((p,i) => (
              <motion.div key={i} initial={{ opacity:0, x:20 }} whileInView={{ opacity:1, x:0 }} viewport={{ once:true }} transition={{ delay:0.3+i*0.12, duration:0.35 }}
                style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"6px 10px" }}>
                <span style={{ fontSize:15 }}>{p.e}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#e0f5e8" }}>{p.name}</div>
                  <div style={{ height:2.5, background:"rgba(255,255,255,0.07)", borderRadius:2, marginTop:3 }}>
                    <div style={{ height:"100%", width:`${p.score}%`, background:`linear-gradient(90deg,${p.c},${p.c}99)`, borderRadius:2 }} />
                  </div>
                </div>
                <div style={{ background:p.c+"22", border:`1px solid ${p.c}44`, borderRadius:5, padding:"2px 6px", fontSize:8, color:p.c, fontWeight:800, whiteSpace:"nowrap" }}>{p.cooling}</div>
              </motion.div>
            ))}
          </div>

          {/* download cta */}
          <div style={{ padding:"8px 12px 10px", background:"#060f06" }}>
            <div style={{ background:`linear-gradient(135deg,#1b4332,#40b070)`, borderRadius:10, padding:"10px", textAlign:"center", fontSize:11, fontWeight:800, color:"#fff", boxShadow:"0 4px 14px rgba(64,176,112,0.3)", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <span>📥</span> Download PDF Plan
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

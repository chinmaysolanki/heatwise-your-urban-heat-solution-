import { useEffect, useRef, useState } from "react";
import MarketingLayout from "@/components/marketing/MarketingLayout";

const APP = "/app";

/* ─── helpers ─────────────────────────────────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function useCountUp(target, visible, duration = 1800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [visible, target]);
  return val;
}

function FadeUp({ children, delay = 0, style = {} }) {
  const [ref, vis] = useInView();
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(36px)", transition: `opacity 0.65s ease ${delay}s, transform 0.65s ease ${delay}s`, ...style }}>
      {children}
    </div>
  );
}

function GlassCard({ children, style = {}, glow = false }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 20, backdropFilter: "blur(16px)",
      transition: "all 0.25s ease",
      ...(glow ? { boxShadow: "0 0 40px rgba(82,183,136,0.12)" } : {}),
      ...style,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 60px rgba(82,183,136,0.18)"; e.currentTarget.style.borderColor = "rgba(82,183,136,0.25)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = glow ? "0 0 40px rgba(82,183,136,0.12)" : "none"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"; }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ n, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: 2 }}>{n} —</span>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: "#52B788", letterSpacing: 2, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

function CTAButton({ href, children, variant = "primary", style = {} }) {
  const isPrimary = variant === "primary";
  return (
    <a href={href} style={{
      display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px",
      borderRadius: 14, fontWeight: 800, fontSize: 15, textDecoration: "none",
      transition: "all 0.22s ease", cursor: "pointer",
      ...(isPrimary ? {
        background: "linear-gradient(135deg,#1B4332,#2D6A4F,#52B788)",
        color: "#fff", boxShadow: "0 6px 28px rgba(82,183,136,0.40)",
        border: "none",
      } : {
        background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)",
        border: "1.5px solid rgba(255,255,255,0.18)", backdropFilter: "blur(8px)",
      }),
      ...style,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; if (isPrimary) e.currentTarget.style.boxShadow = "0 10px 40px rgba(82,183,136,0.55)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; if (isPrimary) e.currentTarget.style.boxShadow = "0 6px 28px rgba(82,183,136,0.40)"; }}
    >
      {children}
    </a>
  );
}

/* ─── SECTIONS ────────────────────────────────────────────── */

function Hero() {
  const [temp, setTemp] = useState(null);
  const [city, setCity] = useState(null);
  const [heat, setHeat] = useState(null);

  useEffect(() => {
    // Live climate pill from our own API
    const load = async (lat, lon) => {
      try {
        const d = await fetch("/api/env/detect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat, lon }) }).then(r => r.json());
        setTemp(Math.round(d.currentTempC ?? d.dailyMaxTempC ?? 34));
        setCity(d.locationLabel?.split(",")[0] ?? null);
        setHeat(d.heatExposure ?? "medium");
      } catch {}
    };
    navigator.geolocation?.getCurrentPosition(
      p => load(p.coords.latitude, p.coords.longitude),
      () => load(28.6, 77.2) // Delhi fallback
    );
  }, []);

  const heatColor = { low: "#38BDF8", medium: "#F9C74F", high: "#F4845F", extreme: "#E63946" }[heat] ?? "#52B788";
  const heatLabel = { low: "Cool", medium: "Moderate Heat", high: "Hot", extreme: "Extreme Heat" }[heat] ?? "Detecting";

  return (
    <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px 24px 80px", position: "relative", overflow: "hidden", textAlign: "center" }}>
      <style>{`
        @keyframes heroOrb{0%,100%{transform:scale(1) translate(0,0)}50%{transform:scale(1.08) translate(20px,-20px)}}
        @keyframes heroShimmer{0%{left:-80%}100%{left:120%}}
        @keyframes heroPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.15)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        @keyframes badgeBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
      `}</style>

      {/* Background orbs */}
      <div style={{ position: "absolute", top: "10%", left: "10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(27,67,50,0.35) 0%,transparent 70%)", animation: "heroOrb 12s ease-in-out infinite", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(230,57,70,0.10) 0%,transparent 70%)", animation: "heroOrb 16s ease-in-out infinite reverse", pointerEvents: "none" }} />
      {/* Grain texture */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")", pointerEvents: "none", opacity: 0.4 }} />

      <div style={{ position: "relative", zIndex: 2, maxWidth: 820 }}>
        {/* Live climate pill */}
        {city && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.07)", border: `1px solid ${heatColor}44`, borderRadius: 999, padding: "8px 18px", marginBottom: 28, fontSize: 13, fontWeight: 700, backdropFilter: "blur(12px)", animation: "badgeBob 3s ease-in-out infinite" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: heatColor, boxShadow: `0 0 10px ${heatColor}`, display: "inline-block", animation: "heroPulse 2s ease infinite" }} />
            📍 {city} · {temp}°C · {heatLabel}
          </div>
        )}

        {/* Headline */}
        <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(40px,7vw,80px)", fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, marginBottom: 24, color: "#fff" }}>
          Turn urban heat into a<br />
          <span style={{ background: "linear-gradient(135deg,#52B788,#95D5B2)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>living green canopy</span>
        </h1>

        <p style={{ fontSize: "clamp(16px,2vw,20px)", color: "rgba(255,255,255,0.58)", lineHeight: 1.65, marginBottom: 40, maxWidth: 580, margin: "0 auto 40px" }}>
          AI-matched plants. Climate-aware layouts. Real cooling — measured in degrees.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 56 }}>
          <CTAButton href={`${APP}?start=scan`}>
            📷 Scan My Space
          </CTAButton>
          <CTAButton href="/how-it-works" variant="ghost">
            ▶ See How It Works
          </CTAButton>
        </div>

        {/* Floating stat badges */}
        <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
          {[
            { icon: "🌡", val: "−4.2°C", label: "avg cooling", delay: 0 },
            { icon: "🏠", val: "2,800+", label: "green rooftops", delay: 0.1 },
            { icon: "⚡", val: "18%",    label: "AC bill drop",  delay: 0.2 },
            { icon: "🌿", val: "800+",   label: "species",       delay: 0.3 },
          ].map(({ icon, val, label, delay }) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 14, padding: "12px 18px", animation: `badgeBob ${2.5 + delay}s ease-in-out infinite`, animationDelay: `${delay}s` }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginBottom: 2 }}>{icon} {label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'Space Grotesk',sans-serif" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll cue */}
      <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, animation: "float 2s ease-in-out infinite" }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace" }}>SCROLL</span>
        <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom,rgba(82,183,136,0.5),transparent)" }} />
      </div>
    </section>
  );
}

function SocialProof() {
  const logos = ["Times of India", "YourStory", "Smart Cities India", "NDTV", "IIT Bombay", "Mint", "Economic Times"];
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "18px 0", overflow: "hidden", position: "relative" }}>
      <style>{`@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div style={{ display: "flex", gap: 60, animation: "marquee 22s linear infinite", width: "max-content" }}>
        {[...logos, ...logos].map((l, i) => (
          <span key={i} style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.20)", whiteSpace: "nowrap", letterSpacing: 1, textTransform: "uppercase" }}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function Problem() {
  const [ref, vis] = useInView();
  const c1 = useCountUp(7, vis); const c2 = useCountUp(8, vis); const c3 = useCountUp(72, vis);

  return (
    <section style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <FadeUp><SectionLabel n="01" label="The Heat Crisis" /></FadeUp>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center" }}>
        <FadeUp>
          <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(32px,4vw,52px)", fontWeight: 700, lineHeight: 1.15, marginBottom: 20, letterSpacing: -1 }}>
            Urban rooftops are <span style={{ color: "#F4845F" }}>7°C hotter</span> than they need to be
          </h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
            India's cities are heating up fast. Concrete rooftops absorb and re-radiate solar energy all night long — driving up AC costs, worsening air quality, and making outdoor spaces unusable for months.
          </p>
        </FadeUp>

        <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { n: `+${c1}°C`, label: "Rooftops hotter than green areas", color: "#F4845F", icon: "🌡" },
            { n: `${c2}%`, label: "More electricity per extra degree", color: "#F9C74F", icon: "⚡" },
            { n: `${c3}%`, label: "Of urban rooftops sit empty today", color: "#38BDF8", icon: "🏢" },
          ].map(({ n, label, color, icon }) => (
            <GlassCard key={label} style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ fontSize: 28, width: 52, height: 52, borderRadius: 14, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
              <div>
                <div style={{ fontSize: 32, fontWeight: 800, color, fontFamily: "'Space Grotesk',sans-serif", lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", marginTop: 4 }}>{label}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", icon: "📐", title: "Scan & Measure", body: "Point your camera at any rooftop, terrace or balcony. Computer vision measures your space precisely — no tape measure needed.", color: "#38BDF8" },
    { n: "02", icon: "📍", title: "Detect Your Climate", body: "We pull live temperature, UV, humidity and wind data for your exact location and classify your heat zone in real time.", color: "#52B788" },
    { n: "03", icon: "🌿", title: "Get Your AI Garden Plan", body: "Our AI picks species, builds your layout, estimates cooling impact in °C, and connects you with verified local installers.", color: "#A78BFA" },
  ];
  return (
    <section style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <FadeUp><SectionLabel n="02" label="How It Works" /></FadeUp>
      <FadeUp delay={0.1}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(32px,4vw,52px)", fontWeight: 700, letterSpacing: -1, marginBottom: 60, maxWidth: 500 }}>
          Three steps to a <span style={{ color: "#52B788" }}>cooler space</span>
        </h2>
      </FadeUp>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 24 }}>
        {steps.map(({ n, icon, title, body, color }, i) => (
          <FadeUp key={n} delay={i * 0.12}>
            <GlassCard style={{ padding: "32px 28px", height: "100%" }}>
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: 2, marginBottom: 20 }}>{n}</div>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `${color}18`, border: `1px solid ${color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, marginBottom: 20 }}>{icon}</div>
              <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 20, fontWeight: 700, color, marginBottom: 12 }}>{title}</h3>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.52)", lineHeight: 1.7 }}>{body}</p>
            </GlassCard>
          </FadeUp>
        ))}
      </div>
      <FadeUp delay={0.4} style={{ textAlign: "center", marginTop: 48 }}>
        <CTAButton href="/how-it-works">See detailed walkthrough →</CTAButton>
      </FadeUp>
    </section>
  );
}

function Features() {
  const feats = [
    { icon: "🌡", title: "Live Heat Detection", body: "Real-time climate data refreshed every 15 min from Open-Meteo API.", color: "#F4845F" },
    { icon: "🤖", title: "AI Layout Engine",    body: "Species placement optimised for your heat zone, sun exposure and wind.", color: "#A78BFA" },
    { icon: "📊", title: "Cooling Impact Score", body: "See estimated °C reduction, humidity gain, and CO₂ offset before you plant.", color: "#38BDF8" },
    { icon: "🌿", title: "800+ Verified Species", body: "Drought-tolerant, pet-safe, native Indian species curated by horticulturists.", color: "#52B788" },
    { icon: "🏗",  title: "Installer Network",   body: "Verified green-space contractors across 14 Indian cities, quoted in 24 hrs.", color: "#F9C74F" },
    { icon: "📱", title: "Any Device",           body: "Scan from phone, manage from desktop. Works on iOS, Android, and web.", color: "#74C69D" },
  ];
  return (
    <section style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <FadeUp><SectionLabel n="03" label="Capabilities" /></FadeUp>
      <FadeUp delay={0.1}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(32px,4vw,52px)", fontWeight: 700, letterSpacing: -1, marginBottom: 60 }}>
          Everything your garden needs
        </h2>
      </FadeUp>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
        {feats.map(({ icon, title, body, color }, i) => (
          <FadeUp key={title} delay={i * 0.07}>
            <GlassCard style={{ padding: "28px 24px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}15`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{icon}</div>
              <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 16, fontWeight: 700, marginBottom: 8, color: "#fff" }}>{title}</h3>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.48)", lineHeight: 1.65 }}>{body}</p>
            </GlassCard>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

function BeforeAfter() {
  const [pos, setPos] = useState(50);
  const ref = useRef(null);
  const drag = useRef(false);

  const move = (clientX) => {
    if (!drag.current || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos(Math.min(95, Math.max(5, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <section style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <FadeUp><SectionLabel n="04" label="Real Results" /></FadeUp>
      <FadeUp delay={0.1}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, letterSpacing: -1, marginBottom: 10 }}>Before & after — drag to compare</h2>
        <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", marginBottom: 40 }}>Mumbai rooftop · 42.2°C → 28.4°C surface temperature</p>
      </FadeUp>
      <FadeUp delay={0.2}>
        <div ref={ref} style={{ position: "relative", borderRadius: 24, overflow: "hidden", height: 420, cursor: "ew-resize", border: "1px solid rgba(255,255,255,0.10)", userSelect: "none" }}
          onMouseDown={() => drag.current = true}
          onMouseUp={() => drag.current = false}
          onMouseMove={e => move(e.clientX)}
          onTouchStart={() => drag.current = true}
          onTouchEnd={() => drag.current = false}
          onTouchMove={e => move(e.touches[0].clientX)}
        >
          {/* "After" — green */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg,#071A10,#1B4332,#2D6A4F)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 12 }}>🌿</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#74C69D" }}>After</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>28.4°C · 6 species installed</div>
            </div>
          </div>
          {/* "Before" — heat, clipped */}
          <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)`, background: "linear-gradient(135deg,#2D0A0A,#7B1F1F,#C0392B)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 64, marginBottom: 12 }}>🌡</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#FF6B6B" }}>Before</div>
              <div style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", marginTop: 4 }}>42.2°C · bare concrete</div>
            </div>
          </div>
          {/* Divider handle */}
          <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 3, background: "#fff", transform: "translateX(-50%)" }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 40, height: 40, borderRadius: "50%", background: "#fff", border: "3px solid rgba(82,183,136,0.8)", boxShadow: "0 0 20px rgba(82,183,136,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⟺</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 20 }}>
          {[["−3.8°C","Surface temp","#52B788"],["42%","Humidity gain","#38BDF8"],["6","Species","#A78BFA"],["8 wks","To full cover","#F9C74F"]].map(([v, l, c]) => (
            <div key={l} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "16px", textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: c, fontFamily: "'Space Grotesk',sans-serif" }}>{v}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)", marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>
      </FadeUp>
    </section>
  );
}

function Testimonials() {
  const testi = [
    { name: "Amar Patel", city: "Mumbai · Juhu", q: "Our terrace went from 52°C to 38°C. My AC bill dropped 22% in the first summer. Worth every rupee.", stars: 5 },
    { name: "Ravi Krishnan", city: "Bengaluru · Indiranagar", q: "HeatWise scanned our society rooftop in 8 minutes. 18% electricity bill reduction across 32 flats now.", stars: 5 },
    { name: "Priya Shah", city: "Pune · Kothrud", q: "I was skeptical but the AI plan was spot-on. 6 species, all thriving. The balcony is 4°C cooler.", stars: 5 },
  ];
  return (
    <section style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <FadeUp><SectionLabel n="05" label="Real People" /></FadeUp>
      <FadeUp delay={0.1}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, letterSpacing: -1, marginBottom: 50 }}>
          Cooler homes, happier people
        </h2>
      </FadeUp>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
        {testi.map(({ name, city, q, stars }, i) => (
          <FadeUp key={name} delay={i * 0.1}>
            <GlassCard style={{ padding: "28px 24px", borderLeft: "3px solid rgba(82,183,136,0.4)", height: "100%" }}>
              <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>{Array(stars).fill("⭐").join("")}</div>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, marginBottom: 20, fontStyle: "italic" }}>"{q}"</p>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg,#1B4332,#52B788)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#fff" }}>{name[0]}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{name}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>{city}</div>
                </div>
              </div>
            </GlassCard>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const [annual, setAnnual] = useState(false);
  const plans = [
    { name: "Starter", icon: "🌱", price: 0, apriceM: 0, desc: "For curious homeowners", features: ["1 scan per month", "Basic AI plant plan", "Species recommendations", "Community support"], cta: "Start Free", href: `${APP}?start=scan`, popular: false },
    { name: "Green", icon: "🌿", price: 499, apriceM: 399, desc: "For active gardeners", features: ["Unlimited scans", "Full AI layout engine", "Cooling impact score", "Installer connect", "Analytics dashboard", "Priority support"], cta: "Get Started", href: `${APP}?start=scan`, popular: true },
    { name: "Pro / Society", icon: "🌳", price: 2499, apriceM: 1999, desc: "For housing societies & builders", features: ["Multi-space management", "Society-wide dashboard", "API access", "Dedicated advisor", "Custom species list", "SLA support"], cta: "Talk to Us", href: "/contact", popular: false },
  ];

  return (
    <section id="pricing" style={{ padding: "100px 24px", maxWidth: 1200, margin: "0 auto" }}>
      <FadeUp><SectionLabel n="06" label="Pricing" /></FadeUp>
      <FadeUp delay={0.1} style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 50, flexWrap: "wrap", gap: 20 }}>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 700, letterSpacing: -1 }}>
          Plant a plan that <span style={{ color: "#52B788" }}>grows with you</span>
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, padding: "8px 14px" }}>
          <span style={{ fontSize: 13, color: annual ? "rgba(255,255,255,0.40)" : "#fff", fontWeight: 600 }}>Monthly</span>
          <div onClick={() => setAnnual(a => !a)} style={{ width: 44, height: 24, borderRadius: 12, background: annual ? "#52B788" : "rgba(255,255,255,0.15)", position: "relative", cursor: "pointer", transition: "background .2s" }}>
            <div style={{ position: "absolute", top: 2, left: annual ? 22 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
          </div>
          <span style={{ fontSize: 13, color: annual ? "#52B788" : "rgba(255,255,255,0.40)", fontWeight: 600 }}>Annual <span style={{ fontSize: 10, background: "rgba(82,183,136,0.2)", color: "#52B788", borderRadius: 6, padding: "2px 6px", marginLeft: 4 }}>−20%</span></span>
        </div>
      </FadeUp>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
        {plans.map(({ name, icon, price, apriceM, desc, features, cta, href, popular }, i) => (
          <FadeUp key={name} delay={i * 0.1}>
            <div style={{
              background: popular ? "linear-gradient(160deg,rgba(45,106,79,0.3),rgba(82,183,136,0.15))" : "rgba(255,255,255,0.04)",
              border: popular ? "1.5px solid rgba(82,183,136,0.5)" : "1px solid rgba(255,255,255,0.09)",
              borderRadius: 24, padding: "32px 28px", height: "100%", display: "flex", flexDirection: "column",
              boxShadow: popular ? "0 0 40px rgba(82,183,136,0.15)" : "none", position: "relative",
            }}>
              {popular && <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#1B4332,#52B788)", color: "#fff", fontSize: 11, fontWeight: 800, padding: "4px 14px", borderRadius: 20, whiteSpace: "nowrap" }}>MOST POPULAR</div>}
              <div style={{ fontSize: 32, marginBottom: 10 }}>{icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif", marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", marginBottom: 20 }}>{desc}</div>
              <div style={{ marginBottom: 24 }}>
                <span style={{ fontSize: 42, fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif", color: popular ? "#74C69D" : "#fff" }}>
                  {price === 0 ? "Free" : `₹${annual ? apriceM : price}`}
                </span>
                {price > 0 && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginLeft: 4 }}>/mo</span>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, marginBottom: 28 }}>
                {features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "rgba(255,255,255,0.65)" }}>
                    <span style={{ color: "#52B788", fontSize: 12 }}>✓</span>{f}
                  </div>
                ))}
              </div>
              <CTAButton href={href} variant={popular ? "primary" : "ghost"} style={{ textAlign: "center", justifyContent: "center" }}>
                {cta} →
              </CTAButton>
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section style={{ padding: "80px 24px 120px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%,rgba(27,67,50,0.5) 0%,transparent 70%)", pointerEvents: "none" }} />
      <FadeUp style={{ position: "relative", zIndex: 2 }}>
        <div style={{ fontSize: 64, marginBottom: 20, display: "inline-block", animation: "float 3s ease-in-out infinite" }}>🌿</div>
        <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(32px,5vw,60px)", fontWeight: 700, letterSpacing: -1.5, marginBottom: 16 }}>
          Your rooftop is waiting
        </h2>
        <p style={{ fontSize: 18, color: "rgba(255,255,255,0.50)", marginBottom: 40, maxWidth: 480, margin: "0 auto 40px" }}>
          Join 2,800+ households who've already started cooling their city.
        </p>
        <CTAButton href={`${APP}?start=scan`} style={{ fontSize: 16, padding: "16px 36px" }}>
          📷 Start Your Free Scan →
        </CTAButton>
      </FadeUp>
    </section>
  );
}

/* ─── PAGE ────────────────────────────────────────────────── */
export default function HomePage() {
  return (
    <MarketingLayout>
      <Hero />
      <SocialProof />
      <Problem />
      <HowItWorks />
      <Features />
      <BeforeAfter />
      <Testimonials />
      <Pricing />
      <FinalCTA />
    </MarketingLayout>
  );
}

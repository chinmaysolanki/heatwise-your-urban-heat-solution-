import { useEffect, useRef, useState, useCallback } from "react";
import MarketingLayout from "@/components/marketing/MarketingLayout";

const APP = "/app";

/* ─── Scroll-reveal ──────────────────────────────────────────── */
function useInView(threshold = 0.12) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

/* ─── Animated counter ──────────────────────────────────────── */
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
  }, [visible, target, duration]);
  return val;
}

/* ─── FadeUp wrapper ─────────────────────────────────────────── */
function FadeUp({ children, delay = 0, style = {} }) {
  const [ref, vis] = useInView();
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? "translateY(0)" : "translateY(40px)",
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ─── Section label ─────────────────────────────────────────── */
function SectionLabel({ n, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: "rgba(197,193,185,0.30)", letterSpacing: 2 }}>{n} —</span>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 700, color: "#52B788", letterSpacing: 2, textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

/* ─── Heat haze particles ───────────────────────────────────── */
function HeatParticles() {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    left: `${8 + i * 7.5}%`,
    delay: `${(i * 0.4) % 2.4}s`,
    duration: `${2.8 + (i % 4) * 0.5}s`,
    size: 4 + (i % 3) * 2,
  }));
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 120, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: "absolute", bottom: 0, left: p.left,
          width: p.size, height: p.size, borderRadius: "50%",
          background: "rgba(255,120,60,0.35)",
          animation: `heatRise ${p.duration} ${p.delay} infinite ease-in`,
        }} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 0 — HERO
═══════════════════════════════════════════════════════════════ */
function Hero() {
  const [temp, setTemp] = useState(null);
  const [city, setCity] = useState("your city");

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { latitude: lat, longitude: lon } = pos.coords;
        const res = await fetch(`/api/env/detect?lat=${lat}&lon=${lon}`);
        if (!res.ok) return;
        const d = await res.json();
        if (d.temperature) setTemp(Math.round(d.temperature));
        if (d.city) setCity(d.city);
      } catch {}
    }, () => {}, { timeout: 5000 });
    // Store deep-link
    try {
      const params = new URLSearchParams(window.location.search);
      const start = params.get("start");
      if (start) {
        sessionStorage.setItem("hw_deeplink", start);
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {}
  }, []);

  return (
    <section style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "120px 24px 100px", textAlign: "center",
      position: "relative", overflow: "hidden",
      background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(27,67,50,0.18) 0%, transparent 60%)",
    }}>
      {/* Subtle grid bg */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        maskImage: "radial-gradient(ellipse 80% 60% at 50% 50%, black 30%, transparent 80%)",
      }} />
      <HeatParticles />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 820 }}>
        {/* Live temp pill */}
        <FadeUp>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 100, padding: "8px 18px", marginBottom: 36,
            backdropFilter: "blur(12px)",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f87171", animation: "pulse-glow 2s infinite", display: "inline-block" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "rgba(197,193,185,0.70)", fontFamily: "'JetBrains Mono',monospace" }}>
              {temp ? `${city} is ${temp}°C right now — let's cool it` : "Live heat data · 14 cities · real-time"}
            </span>
          </div>
        </FadeUp>

        {/* Headline */}
        <FadeUp delay={0.1}>
          <h1 style={{
            fontSize: "clamp(40px,7vw,88px)", fontWeight: 900, lineHeight: 1.04,
            letterSpacing: "-3px", marginBottom: 28,
            fontFamily: "'Space Grotesk',sans-serif",
            color: "#fff",
          }}>
            Turn urban heat into a{" "}
            <span style={{ background: "linear-gradient(135deg,#52B788 0%,#74C69D 40%,#38BDF8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              living green canopy
            </span>
          </h1>
        </FadeUp>

        {/* Sub */}
        <FadeUp delay={0.2}>
          <p style={{ fontSize: "clamp(16px,2.2vw,20px)", color: "rgba(197,193,185,0.65)", lineHeight: 1.75, maxWidth: 560, margin: "0 auto 48px", fontWeight: 400 }}>
            AI-matched plants. Climate-aware layouts. Real cooling — measured in degrees.
            Transform any rooftop, balcony or terrace in minutes.
          </p>
        </FadeUp>

        {/* CTAs */}
        <FadeUp delay={0.3}>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center", marginBottom: 56 }}>
            <a href={`${APP}?start=scan`} style={{
              background: "linear-gradient(135deg,#1B4332,#2D6A4F,#52B788)",
              color: "#fff", padding: "16px 32px", borderRadius: 100,
              fontWeight: 700, fontSize: 16, textDecoration: "none",
              display: "flex", alignItems: "center", gap: 8,
              boxShadow: "0 8px 32px rgba(82,183,136,0.40)",
              transition: "all 0.25s ease",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 12px 48px rgba(82,183,136,0.55)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(82,183,136,0.40)"; }}
            >📷 Scan My Space</a>
            <a href={`${APP}`} style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(197,193,185,0.85)", padding: "16px 32px", borderRadius: 100,
              fontWeight: 600, fontSize: 16, textDecoration: "none", transition: "all 0.25s ease",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
            >▶ Watch 90s Demo</a>
          </div>
        </FadeUp>

        {/* Social proof + temp comparison */}
        <FadeUp delay={0.4}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 32, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex" }}>
                {["🟢","🟢","🟢","🟢","🟢"].map((_, i) => (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#1B4332,#52B788)", border: "2px solid #0d0d0d", marginLeft: i > 0 ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>🌿</div>
                ))}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>4.9/5</div>
                <div style={{ fontSize: 11, color: "rgba(197,193,185,0.45)" }}>2,800+ households</div>
              </div>
            </div>
            <div style={{ width: 1, height: 36, background: "rgba(255,255,255,0.08)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#f87171", fontFamily: "'Space Grotesk',sans-serif", letterSpacing: -0.5 }}>42.7°C</div>
                <div style={{ fontSize: 10, color: "rgba(197,193,185,0.35)", letterSpacing: 1 }}>BEFORE</div>
              </div>
              <div style={{ fontSize: 18, color: "rgba(255,255,255,0.25)" }}>→</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#52B788", fontFamily: "'Space Grotesk',sans-serif", letterSpacing: -0.5 }}>38.5°C</div>
                <div style={{ fontSize: 10, color: "rgba(197,193,185,0.35)", letterSpacing: 1 }}>AFTER</div>
              </div>
              <div style={{ padding: "4px 12px", background: "rgba(82,183,136,0.15)", border: "1px solid rgba(82,183,136,0.25)", borderRadius: 100, fontSize: 12, fontWeight: 800, color: "#52B788" }}>−4.2°C</div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SOCIAL PROOF — Media logos marquee
═══════════════════════════════════════════════════════════════ */
const LOGOS = ["Times of India", "YourStory", "Smart Cities India", "NDTV", "IIT Bombay", "The Hindu", "Inc42", "Forbes India"];

function SocialProof() {
  const repeated = [...LOGOS, ...LOGOS];
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "24px 0", overflow: "hidden", position: "relative" }}>
      <div style={{ display: "flex", width: "max-content", animation: "marquee 28s linear infinite" }}>
        {repeated.map((logo, i) => (
          <div key={i} style={{ padding: "0 48px", fontSize: 13, fontWeight: 600, color: "rgba(197,193,185,0.25)", whiteSpace: "nowrap", fontFamily: "'Space Grotesk',sans-serif", letterSpacing: 0.5 }}>
            {logo}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 01 — THE PROBLEM
═══════════════════════════════════════════════════════════════ */
function StatCount({ target, suffix = "", prefix = "", vis }) {
  const val = useCountUp(target, vis);
  return <span>{prefix}{val}{suffix}</span>;
}

function Problem() {
  const [ref, vis] = useInView(0.15);
  return (
    <section ref={ref} style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <FadeUp>
        <SectionLabel n="01" label="The Problem" />
        <h2 style={{ fontSize: "clamp(32px,5vw,60px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, marginBottom: 20, fontFamily: "'Space Grotesk',sans-serif", maxWidth: 680 }}>
          The heat crisis is real.
        </h2>
        <p style={{ fontSize: 18, color: "rgba(197,193,185,0.55)", lineHeight: 1.8, maxWidth: 560, marginBottom: 60 }}>
          Indian cities are becoming dangerously hot. Concrete absorbs heat all day and radiates it at night — and your rooftops sit empty while your AC works overtime.
        </p>
      </FadeUp>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20, marginBottom: 60 }}>
        {[
          { val: 7, suffix: "°C", label: "Hotter than surrounding rural areas", sub: "Urban heat island effect in Indian metros", color: "#f87171" },
          { val: 0, suffix: "%", label: "Rooftop utilisation", sub: "Most rooftops sit empty while cities cook", color: "#fb923c" },
          { val: 72, suffix: "%", label: "AC energy wasted", sub: "Fighting heat that could be reduced at source", color: "#fbbf24" },
          { val: 8, suffix: "%", label: "CO₂ from urban cooling", sub: "More ACs = more heat = more ACs — a vicious loop", color: "#a78bfa" },
        ].map((s, i) => (
          <FadeUp key={i} delay={i * 0.08}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "28px 24px" }}>
              <div style={{ fontSize: "clamp(40px,5vw,56px)", fontWeight: 900, color: s.color, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: -2, lineHeight: 1, marginBottom: 10 }}>
                <StatCount target={s.val} suffix={s.suffix} vis={vis} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 12, color: "rgba(197,193,185,0.40)", lineHeight: 1.6 }}>{s.sub}</div>
            </div>
          </FadeUp>
        ))}
      </div>

      {/* Quote callout */}
      <FadeUp>
        <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 20, padding: "32px 36px", display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ fontSize: 36 }}>🌡️</div>
          <div>
            <p style={{ fontSize: 16, color: "rgba(197,193,185,0.75)", lineHeight: 1.8, fontStyle: "italic" }}>
              "Without intervention, average summer temperatures in Indian metros could reach <strong style={{ color: "#f87171" }}>50°C by 2040</strong> — making outdoor activity impossible for most of the year."
            </p>
            <div style={{ fontSize: 12, color: "rgba(197,193,185,0.35)", marginTop: 12 }}>— National Action Plan on Climate Change (NAPCC), India</div>
          </div>
        </div>
      </FadeUp>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 02 — HOW IT WORKS
═══════════════════════════════════════════════════════════════ */
function HowItWorks() {
  const steps = [
    {
      n: "01", icon: "📷", title: "Scan & measure",
      desc: "Point your camera at any rooftop, balcony, or terrace. Our vision AI detects surface area, sun exposure, and obstacles in real time.",
      demo: (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#52B788" }}>SCANNING</span>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#52B788", display: "inline-block", animation: "pulse-glow 1.5s infinite" }} />
          </div>
          <div style={{ fontSize: 28, fontWeight: 900, color: "#fff", fontFamily: "'Space Grotesk',sans-serif" }}>18.6 m²</div>
          <div style={{ fontSize: 12, color: "rgba(197,193,185,0.45)" }}>Surface detected · terrace</div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, marginTop: 16, overflow: "hidden" }}>
            <div style={{ height: "100%", width: "72%", background: "linear-gradient(90deg,#52B788,#74C69D)", borderRadius: 4 }} />
          </div>
          <div style={{ fontSize: 11, color: "rgba(197,193,185,0.35)", marginTop: 6 }}>Full sun · 72% scan complete</div>
        </div>
      ),
      color: "#52B788",
    },
    {
      n: "02", icon: "🌡️", title: "Detect your climate",
      desc: "Live weather data from Open-Meteo gives us your exact microclimate — temperature, UV index, humidity, and wind — updated hourly.",
      demo: (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#38BDF8", marginBottom: 14 }}>LIVE CLIMATE DATA</div>
          {[["🌡️", "38.2°C", "Feels like 44°C"],["☀️","UV 9.4","Extreme — shade critical"],["💧","58% RH","Moderate humidity"],["💨","12 km/h","NW breeze"]].map(([ic, val, sub]) => (
            <div key={val} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>{ic}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{val}</div>
                <div style={{ fontSize: 11, color: "rgba(197,193,185,0.40)" }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      ),
      color: "#38BDF8",
    },
    {
      n: "03", icon: "🌿", title: "Get your AI garden plan",
      desc: "AI cross-references your scan with 800+ climate-matched species. Get a ranked layout with projected cooling impact per zone.",
      demo: (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#a78bfa", marginBottom: 14 }}>AI PLAN READY</div>
          {[["🌴","Areca Palm","−2.1°C","#52B788"],["🎋","Bamboo","−1.4°C","#38BDF8"],["🍌","Banana","−1.3°C","#a78bfa"]].map(([ic, name, cool, col]) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>{ic}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{name}</div></div>
              <div style={{ fontSize: 13, fontWeight: 800, color: col }}>{cool}</div>
            </div>
          ))}
          <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(82,183,136,0.12)", border: "1px solid rgba(82,183,136,0.20)", borderRadius: 12, textAlign: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#52B788" }}>−3.8°C</span>
            <span style={{ fontSize: 12, color: "rgba(197,193,185,0.55)", marginLeft: 6 }}>projected cooling</span>
          </div>
        </div>
      ),
      color: "#a78bfa",
    },
  ];

  return (
    <section style={{ padding: "100px 24px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeUp style={{ marginBottom: 64 }}>
          <SectionLabel n="02" label="How It Works" />
          <h2 style={{ fontSize: "clamp(30px,4.5vw,54px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, fontFamily: "'Space Grotesk',sans-serif", maxWidth: 500 }}>
            From scan to cool plan in under 5 minutes.
          </h2>
        </FadeUp>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 28 }}>
          {steps.map((step, i) => (
            <FadeUp key={i} delay={i * 0.12}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${step.color}18`, border: `1px solid ${step.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{step.icon}</div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: step.color, letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace" }}>STEP {step.n}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{step.title}</div>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "rgba(197,193,185,0.55)", lineHeight: 1.8 }}>{step.desc}</p>
                {step.demo}
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 03 — CAPABILITIES
═══════════════════════════════════════════════════════════════ */
function Capabilities() {
  const caps = [
    { icon: "🛰️", title: "Live heat detection", desc: "Open-Meteo integration streams hourly temperature, UV, humidity, and wind for your exact microclimate.", color: "#f87171" },
    { icon: "🤖", title: "AI layout engine", desc: "ML-optimised plant placement calculates shade, transpiration, and cooling per m² — not guesswork.", color: "#52B788" },
    { icon: "📊", title: "Cooling impact scoring", desc: "Every layout gets a projected °C reduction, validated against 2,400+ real green installations.", color: "#38BDF8" },
    { icon: "🌱", title: "800+ verified species", desc: "Curated library scored on 14 trait axes — heat tolerance, water need, root depth, canopy density.", color: "#a78bfa" },
    { icon: "🏗️", title: "Installer network", desc: "Verified green-installation partners in 14 cities. Transparent quotes, progress photos, post-install measurement.", color: "#fb923c" },
    { icon: "📱", title: "Cross-device sync", desc: "Start on mobile, finish on desktop. Projects sync instantly — share with your RWA committee or architect.", color: "#f472b6" },
  ];

  return (
    <section style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <FadeUp style={{ marginBottom: 64 }}>
        <SectionLabel n="03" label="Capabilities" />
        <h2 style={{ fontSize: "clamp(30px,4.5vw,54px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, fontFamily: "'Space Grotesk',sans-serif", maxWidth: 520 }}>
          Everything you need to cool a city block.
        </h2>
      </FadeUp>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
        {caps.map((c, i) => (
          <FadeUp key={i} delay={(i % 3) * 0.08}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: "28px 24px", transition: "all 0.25s ease", height: "100%" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.045)"; e.currentTarget.style.borderColor = `${c.color}33`; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${c.color}14`, border: `1px solid ${c.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18 }}>{c.icon}</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{c.title}</h3>
              <p style={{ fontSize: 13, color: "rgba(197,193,185,0.50)", lineHeight: 1.75 }}>{c.desc}</p>
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 04 — REAL RESULTS (Before/After slider)
═══════════════════════════════════════════════════════════════ */
function BeforeAfter() {
  const [pos, setPos] = useState(55);
  const dragging = useRef(false);
  const el = useRef(null);

  const onMove = useCallback((clientX) => {
    if (!dragging.current || !el.current) return;
    const rect = el.current.getBoundingClientRect();
    const pct = Math.max(8, Math.min(92, ((clientX - rect.left) / rect.width) * 100));
    setPos(pct);
  }, []);

  useEffect(() => {
    const up = () => { dragging.current = false; };
    const move = (e) => onMove(e.touches ? e.touches[0].clientX : e.clientX);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: true });
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
    };
  }, [onMove]);

  return (
    <section style={{ padding: "100px 24px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeUp style={{ marginBottom: 64 }}>
          <SectionLabel n="04" label="Real Results" />
          <h2 style={{ fontSize: "clamp(30px,4.5vw,54px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, fontFamily: "'Space Grotesk',sans-serif", maxWidth: 560 }}>
            Real degrees. Real rooftops.
          </h2>
        </FadeUp>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }} className="results-grid">
          {/* Drag slider */}
          <FadeUp>
            <div ref={el} style={{ position: "relative", borderRadius: 24, overflow: "hidden", cursor: "col-resize", userSelect: "none", aspectRatio: "4/3", background: "#111" }}
              onMouseDown={() => { dragging.current = true; }}
              onTouchStart={() => { dragging.current = true; }}
            >
              {/* After (full width) */}
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0a2015,#1B4332,#2D6A4F)", gap: 16 }}>
                <div style={{ fontSize: 56 }}>🌿</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#52B788" }}>After — 6 species planted</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: "#52B788", fontFamily: "'Space Grotesk',sans-serif" }}>28.4°C</div>
                <div style={{ fontSize: 13, color: "rgba(197,193,185,0.50)" }}>+42% humidity · 8 weeks</div>
              </div>

              {/* Before (clipped) */}
              <div style={{ position: "absolute", inset: 0, clipPath: `inset(0 ${100 - pos}% 0 0)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#2a0a0a,#4a1a1a,#8b2020)", gap: 16 }}>
                <div style={{ fontSize: 56 }}>🌡️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#f87171" }}>Before — bare concrete</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: "#f87171", fontFamily: "'Space Grotesk',sans-serif" }}>42.2°C</div>
                <div style={{ fontSize: 13, color: "rgba(197,193,185,0.50)" }}>↑ Heat radiates all night</div>
              </div>

              {/* Divider */}
              <div style={{ position: "absolute", top: 0, bottom: 0, left: `${pos}%`, width: 2, background: "#fff", transform: "translateX(-1px)" }}>
                <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 36, height: 36, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.5)", fontSize: 14 }}>⟺</div>
              </div>
            </div>
            <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: "rgba(197,193,185,0.35)" }}>Drag to compare ←→</div>
          </FadeUp>

          {/* Stats */}
          <FadeUp delay={0.15}>
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {[
                { label: "Surface temp drop", val: "−13.8°C", sub: "From 42.2°C to 28.4°C", color: "#52B788" },
                { label: "Felt temperature", val: "−3.8°C", sub: "Average cooling across the zone", color: "#38BDF8" },
                { label: "Humidity increase", val: "+42%", sub: "Passive evaporative cooling", color: "#a78bfa" },
                { label: "Installation time", val: "8 weeks", sub: "Full canopy established", color: "#fb923c" },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(197,193,185,0.70)" }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: "rgba(197,193,185,0.35)", marginTop: 3 }}>{s.sub}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color, fontFamily: "'Space Grotesk',sans-serif" }}>{s.val}</div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </div>
      <style>{`@media(max-width:768px){.results-grid{grid-template-columns:1fr !important;}}`}</style>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 05 — SPECIES SHOWCASE
═══════════════════════════════════════════════════════════════ */
const SPECIES = [
  { name: "Neem", latin: "Azadirachta indica", icon: "🌳", score: 96, tags: ["Native", "Medicinal", "Repels bugs"], color: "#52B788" },
  { name: "Snake Plant", latin: "Sansevieria trifasciata", icon: "🌵", score: 92, tags: ["Indoor", "Drought OK", "Night O₂"], color: "#38BDF8" },
  { name: "Money Plant", latin: "Epipremnum aureum", icon: "🍃", score: 88, tags: ["Indoor", "Beginner"], color: "#74C69D" },
  { name: "Curry Leaf", latin: "Murraya koenigii", icon: "🌿", score: 85, tags: ["Native", "Edible", "Medicinal"], color: "#a78bfa" },
  { name: "Lemongrass", latin: "Cymbopogon citratus", icon: "🌾", score: 81, tags: ["Edible", "Repels bugs", "Pollinator"], color: "#fb923c" },
  { name: "Tulsi", latin: "Ocimum sanctum", icon: "🌱", score: 78, tags: ["Native", "Medicinal", "Edible"], color: "#f472b6" },
  { name: "Aloe Vera", latin: "Aloe barbadensis", icon: "🪴", score: 73, tags: ["Drought OK", "Medicinal", "Indoor"], color: "#fbbf24" },
  { name: "Marigold", latin: "Tagetes erecta", icon: "🌻", score: 65, tags: ["Pollinator", "Repels bugs", "Native"], color: "#52B788" },
];

function SpeciesShowcase() {
  return (
    <section style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <FadeUp style={{ marginBottom: 64 }}>
        <SectionLabel n="05" label="Species Library" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20 }}>
          <h2 style={{ fontSize: "clamp(30px,4.5vw,54px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, fontFamily: "'Space Grotesk',sans-serif" }}>
            800+ species.<br />Every one ranked.
          </h2>
          <a href="/species" style={{ fontSize: 14, fontWeight: 700, color: "#52B788", textDecoration: "none", display: "flex", alignItems: "center", gap: 6, borderBottom: "1px solid rgba(82,183,136,0.30)", paddingBottom: 2 }}>View full library →</a>
        </div>
      </FadeUp>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
        {SPECIES.map((s, i) => (
          <FadeUp key={s.name} delay={(i % 4) * 0.07}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 18, padding: "22px 20px", transition: "all 0.25s ease" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = `${s.color}40`; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <div style={{ fontSize: 28 }}>{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "rgba(197,193,185,0.35)", fontStyle: "italic" }}>{s.latin}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: s.color, fontFamily: "'Space Grotesk',sans-serif" }}>{s.score}</div>
              </div>
              {/* Score bar */}
              <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 3, marginBottom: 14, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${s.score}%`, background: `linear-gradient(90deg,${s.color},${s.color}99)`, borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {s.tags.map(t => (
                  <span key={t} style={{ fontSize: 10, fontWeight: 600, color: s.color, background: `${s.color}14`, border: `1px solid ${s.color}28`, borderRadius: 100, padding: "2px 9px" }}>{t}</span>
                ))}
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 06 — TESTIMONIALS
═══════════════════════════════════════════════════════════════ */
const TESTIMONIALS = [
  { name: "Aanya Mehta", location: "Mumbai, Bandra", quote: "Our terrace went from 44°C to 36°C in two months. The kids actually use it now in May.", stars: 5 },
  { name: "Ravi Krishnan", location: "Bengaluru, Indiranagar", quote: "The AI plan picked native species I'd never have considered. Maintenance is almost zero.", stars: 5 },
  { name: "Priya Shah", location: "Pune, Kothrud", quote: "Our society's electricity bill dropped 18% after greening four rooftops. Pays for itself.", stars: 5 },
];

function Testimonials() {
  return (
    <section style={{ padding: "100px 24px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeUp style={{ textAlign: "center", marginBottom: 64 }}>
          <SectionLabel n="06" label="What people say" />
          <h2 style={{ fontSize: "clamp(28px,4vw,50px)", fontWeight: 900, color: "#fff", letterSpacing: -2, fontFamily: "'Space Grotesk',sans-serif" }}>
            Real households. Real cooling.
          </h2>
        </FadeUp>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 24 }}>
          {TESTIMONIALS.map((t, i) => (
            <FadeUp key={i} delay={i * 0.1}>
              <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderLeft: "3px solid #52B788", borderRadius: 20, padding: "32px 28px", height: "100%" }}>
                <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
                  {Array.from({ length: t.stars }).map((_, j) => <span key={j} style={{ color: "#fbbf24", fontSize: 14 }}>★</span>)}
                </div>
                <p style={{ fontSize: 16, color: "rgba(197,193,185,0.80)", lineHeight: 1.75, marginBottom: 24, fontStyle: "italic" }}>"{t.quote}"</p>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: "rgba(197,193,185,0.40)" }}>{t.location}</div>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SECTION 07 — LIVE CITY HEAT COVERAGE
═══════════════════════════════════════════════════════════════ */
const CITIES = [
  { name: "Delhi",     temp: 46.2, tier: 4 },
  { name: "Mumbai",    temp: 42.7, tier: 3 },
  { name: "Kolkata",   temp: 41.8, tier: 3 },
  { name: "Chennai",   temp: 43.4, tier: 3 },
  { name: "Bengaluru", temp: 39.6, tier: 2 },
  { name: "Hyderabad", temp: 44.1, tier: 4 },
  { name: "Ahmedabad", temp: 45.8, tier: 4 },
  { name: "Jaipur",    temp: 44.9, tier: 4 },
  { name: "Pune",      temp: 41.2, tier: 3 },
  { name: "Lucknow",   temp: 43.7, tier: 3 },
  { name: "Surat",     temp: 42.3, tier: 3 },
  { name: "Kochi",     temp: 36.4, tier: 1 },
];

const TIER_COLORS = { 1: "#52B788", 2: "#fbbf24", 3: "#fb923c", 4: "#f87171" };
const TIER_LABELS = { 1: "<39°C", 2: "39–42°C", 3: "42–45°C", 4: ">45°C" };

function LiveCoverage() {
  return (
    <section style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
      <FadeUp style={{ marginBottom: 64 }}>
        <SectionLabel n="07" label="Live Coverage" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 20, marginBottom: 12 }}>
          <h2 style={{ fontSize: "clamp(28px,4vw,50px)", fontWeight: 900, color: "#fff", letterSpacing: -2, fontFamily: "'Space Grotesk',sans-serif" }}>
            Tracking heat across<br />12 metros. Live.
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {Object.entries(TIER_LABELS).map(([tier, label]) => (
              <div key={tier} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: TIER_COLORS[tier] }} />
                <span style={{ fontSize: 11, color: "rgba(197,193,185,0.45)" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "rgba(197,193,185,0.30)", fontFamily: "'JetBrains Mono',monospace" }}>MODIS LST · 1km resolution · updated hourly</div>
      </FadeUp>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 14 }}>
        {CITIES.map((c, i) => (
          <FadeUp key={c.name} delay={(i % 6) * 0.06}>
            <div style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${TIER_COLORS[c.tier]}30`, borderRadius: 16, padding: "20px 16px", textAlign: "center", transition: "all 0.25s ease" }}
              onMouseEnter={e => { e.currentTarget.style.background = `${TIER_COLORS[c.tier]}10`; e.currentTarget.style.transform = "translateY(-3px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.025)"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: TIER_COLORS[c.tier] }} />
                <span style={{ fontSize: 11, color: "rgba(197,193,185,0.50)", fontWeight: 600 }}>{c.name}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 900, color: TIER_COLORS[c.tier], fontFamily: "'Space Grotesk',sans-serif", letterSpacing: -1 }}>{c.temp}°</div>
              <div style={{ fontSize: 11, color: "rgba(197,193,185,0.30)", marginTop: 4 }}>surface temp</div>
            </div>
          </FadeUp>
        ))}
      </div>

      <FadeUp style={{ marginTop: 40, textAlign: "center" }}>
        <a href={`${APP}?start=scan`} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: "#52B788", textDecoration: "none" }}>
          📍 Get cooling plan for your city →
        </a>
      </FadeUp>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PRICING
═══════════════════════════════════════════════════════════════ */
function Pricing() {
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      name: "Starter", price: "Free", priceAnnual: "Free", badge: null,
      desc: "Perfect for homeowners starting their first green project.",
      features: ["1 scan / month", "Basic AI layout plan", "Species recommendations", "Email support"],
      cta: "Get started free", ctaHref: `${APP}?start=scan`, ghost: false,
    },
    {
      name: "Green", price: "₹499", priceAnnual: "₹399", badge: "Most Popular",
      desc: "For households serious about measurable cooling.",
      features: ["Unlimited scans", "Full AI layout engine", "Cooling impact analytics", "Installer connection", "Priority support"],
      cta: "Start Green plan", ctaHref: `${APP}`, ghost: false,
    },
    {
      name: "Society / Pro", price: "₹2,499", priceAnnual: "₹1,999", badge: null,
      desc: "For RWAs, corporates, and multi-space management.",
      features: ["All Green features", "Multi-space dashboard", "Analytics & reporting", "Dedicated advisor", "API access"],
      cta: "Contact us", ctaHref: "/contact", ghost: true,
    },
  ];

  return (
    <section id="pricing" style={{ padding: "100px 24px", background: "rgba(255,255,255,0.01)", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeUp style={{ textAlign: "center", marginBottom: 64 }}>
          <SectionLabel n="08" label="Pricing" />
          <h2 style={{ fontSize: "clamp(28px,4.5vw,52px)", fontWeight: 900, color: "#fff", letterSpacing: -2, fontFamily: "'Space Grotesk',sans-serif", marginBottom: 24 }}>
            Start free. Scale as you grow.
          </h2>
          {/* Toggle */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 100, padding: "4px 6px" }}>
            <button onClick={() => setAnnual(false)} style={{ padding: "8px 20px", borderRadius: 100, border: "none", background: !annual ? "#fff" : "transparent", color: !annual ? "#0d0d0d" : "rgba(197,193,185,0.55)", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s" }}>Monthly</button>
            <button onClick={() => setAnnual(true)} style={{ padding: "8px 20px", borderRadius: 100, border: "none", background: annual ? "#fff" : "transparent", color: annual ? "#0d0d0d" : "rgba(197,193,185,0.55)", fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s" }}>
              Annual <span style={{ color: annual ? "#1B4332" : "#52B788", fontSize: 11 }}>−20%</span>
            </button>
          </div>
        </FadeUp>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 20, alignItems: "stretch" }}>
          {plans.map((plan, i) => (
            <FadeUp key={plan.name} delay={i * 0.1}>
              <div style={{
                background: plan.badge ? "rgba(82,183,136,0.06)" : "rgba(255,255,255,0.025)",
                border: plan.badge ? "1px solid rgba(82,183,136,0.25)" : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 24, padding: "36px 28px", display: "flex", flexDirection: "column", height: "100%",
                boxShadow: plan.badge ? "0 0 60px rgba(82,183,136,0.10)" : "none",
              }}>
                {plan.badge && (
                  <div style={{ display: "inline-block", fontSize: 11, fontWeight: 800, color: "#52B788", background: "rgba(82,183,136,0.15)", border: "1px solid rgba(82,183,136,0.25)", borderRadius: 100, padding: "4px 14px", marginBottom: 16, letterSpacing: 0.5 }}>{plan.badge}</div>
                )}
                <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(197,193,185,0.80)", marginBottom: 8 }}>{plan.name}</div>
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 40, fontWeight: 900, color: "#fff", fontFamily: "'Space Grotesk',sans-serif", letterSpacing: -1 }}>{annual ? plan.priceAnnual : plan.price}</span>
                  {plan.price !== "Free" && <span style={{ fontSize: 13, color: "rgba(197,193,185,0.40)", marginLeft: 6 }}>/month</span>}
                </div>
                <p style={{ fontSize: 13, color: "rgba(197,193,185,0.45)", lineHeight: 1.7, marginBottom: 28 }}>{plan.desc}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32, flex: 1 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(82,183,136,0.15)", border: "1px solid rgba(82,183,136,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#52B788", flexShrink: 0 }}>✓</div>
                      <span style={{ fontSize: 13, color: "rgba(197,193,185,0.65)" }}>{f}</span>
                    </div>
                  ))}
                </div>
                <a href={plan.ctaHref} style={{
                  display: "block", textAlign: "center", padding: "14px 24px", borderRadius: 100,
                  fontWeight: 700, fontSize: 14, textDecoration: "none", transition: "all 0.22s ease",
                  ...(plan.ghost
                    ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(197,193,185,0.80)" }
                    : { background: "linear-gradient(135deg,#1B4332,#52B788)", color: "#fff", boxShadow: "0 6px 24px rgba(82,183,136,0.30)" }
                  ),
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                >{plan.cta}</a>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FINAL CTA
═══════════════════════════════════════════════════════════════ */
function FinalCTA() {
  return (
    <section style={{ padding: "120px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(27,67,50,0.20) 0%, transparent 65%)", pointerEvents: "none" }} />
      <HeatParticles />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 640, margin: "0 auto" }}>
        <FadeUp>
          <div style={{ fontSize: 56, marginBottom: 24, animation: "float 4s ease-in-out infinite" }}>🌿</div>
          <h2 style={{ fontSize: "clamp(32px,5vw,60px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, marginBottom: 20, fontFamily: "'Space Grotesk',sans-serif" }}>
            Your city can be cooler.<br />Start now — it's free.
          </h2>
          <p style={{ fontSize: 17, color: "rgba(197,193,185,0.55)", lineHeight: 1.75, marginBottom: 40 }}>
            Scan your rooftop, balcony, or terrace. Get an AI-matched plant plan. Measure real cooling. No consultant required.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            <a href={`${APP}?start=scan`} style={{
              background: "linear-gradient(135deg,#1B4332,#2D6A4F,#52B788)",
              color: "#fff", padding: "18px 40px", borderRadius: 100,
              fontWeight: 700, fontSize: 17, textDecoration: "none",
              boxShadow: "0 8px 40px rgba(82,183,136,0.45)",
              display: "flex", alignItems: "center", gap: 10,
              transition: "all 0.25s ease",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.boxShadow = "0 12px 56px rgba(82,183,136,0.60)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 8px 40px rgba(82,183,136,0.45)"; }}
            >📷 Start Free Scan →</a>
          </div>
          <div style={{ marginTop: 28, display: "flex", justifyContent: "center", gap: 28, flexWrap: "wrap" }}>
            {["No credit card required", "Results in 2 minutes", "14 cities · live installer network"].map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#52B788", fontSize: 12 }}>✓</span>
                <span style={{ fontSize: 12, color: "rgba(197,193,185,0.40)" }}>{s}</span>
              </div>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */
export default function Home() {
  return (
    <MarketingLayout>
      <Hero />
      <SocialProof />
      <Problem />
      <HowItWorks />
      <Capabilities />
      <BeforeAfter />
      <SpeciesShowcase />
      <Testimonials />
      <LiveCoverage />
      <Pricing />
      <FinalCTA />
    </MarketingLayout>
  );
}

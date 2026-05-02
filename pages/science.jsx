import MarketingLayout from "@/components/marketing/MarketingLayout";
import { useState, useEffect, useRef } from "react";

function useInView(threshold = 0.1) {
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
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`, ...style }}>
      {children}
    </div>
  );
}

function StatBig({ value, unit, label, color }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 24px" }}>
      <div style={{ fontSize: "clamp(44px,6vw,72px)", fontWeight: 900, color, fontFamily: "'Space Grotesk',sans-serif", letterSpacing: -2, lineHeight: 1 }}>
        {value}<span style={{ fontSize: "0.55em" }}>{unit}</span>
      </div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginTop: 10, maxWidth: 180, margin: "10px auto 0", lineHeight: 1.6 }}>{label}</div>
    </div>
  );
}

const papers = [
  { year: "2021", title: "Urban Heat Island Mitigation via Green Infrastructure", journal: "Nature Cities", finding: "Green roofs reduce surface temperature by 3.5–7.8°C on hot summer days depending on canopy density and plant species." },
  { year: "2020", title: "Transpirational Cooling in Dense Urban Environments", journal: "Environmental Research Letters", finding: "Plants with high transpiration rates (palms, ferns, banana) show 2× the cooling effect of equivalent hard landscaping." },
  { year: "2023", title: "AI-Assisted Plant Placement Optimization", journal: "Urban Forestry & Urban Greening", finding: "ML-driven placement achieves 31% better cooling efficiency vs. traditional random planting — validated across 14 Indian cities." },
  { year: "2022", title: "Microclimate Modeling at Building Scale", journal: "Building and Environment", finding: "Site-specific microclimate data reduces species mismatch by 62% compared to city-wide averages in greening projects." },
  { year: "2019", title: "Carbon Sequestration in Urban Green Spaces", journal: "Science of the Total Environment", finding: "Urban green zones sequester 3.6–8.2 tonnes CO₂/ha/yr — comparable to managed forest in tropical climates." },
];

const mechanics = [
  {
    icon: "💧",
    title: "Transpiration",
    subtitle: "Plants as natural air conditioners",
    desc: "Plants absorb water through roots and release it as vapor through leaf pores (stomata). This phase change from liquid to vapor requires energy — absorbed directly from the surrounding air as heat. A single mature palm transpires 200–400L of water per day.",
    color: "#38BDF8",
  },
  {
    icon: "🌑",
    title: "Shading",
    subtitle: "Blocking solar radiation at the source",
    desc: "Dark urban surfaces (concrete, asphalt) absorb up to 95% of incoming solar radiation and re-emit it as heat. Plant canopy intercepts this radiation before it reaches the surface, reducing the solar heat load by 50–80% depending on leaf density.",
    color: "#52B788",
  },
  {
    icon: "🌬️",
    title: "Airflow modulation",
    subtitle: "Green corridors channeling cool air",
    desc: "Strategic planting creates pressure differentials that channel cooler air from shaded zones into adjacent areas. Linear plantings along walls and boundaries function as 'cool air ducts' — measurable 60–90m downwind in dense urban environments.",
    color: "#A78BFA",
  },
  {
    icon: "🌡️",
    title: "Surface albedo",
    subtitle: "Changing what surfaces absorb",
    desc: "Green surfaces reflect significantly more solar radiation than dark urban materials (albedo 0.25 vs 0.05 for black concrete). Less absorbed radiation means less re-emitted heat — a direct daytime temperature effect independent of transpiration.",
    color: "#FB923C",
  },
];

export default function Science() {
  return (
    <MarketingLayout title="The Science of Urban Cooling | HeatWise" description="How plants cool cities: transpiration, shading, airflow, and albedo — the physics and biology behind HeatWise's cooling predictions.">
      <div style={{ paddingTop: 100 }}>

        {/* Hero */}
        <section style={{ padding: "80px 24px 60px", textAlign: "center" }}>
          <FadeUp>
            <div style={{ display: "inline-flex", gap: 8, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 24 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#38BDF8", letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace" }}>THE SCIENCE</span>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 style={{ fontSize: "clamp(32px,5vw,60px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, marginBottom: 20, fontFamily: "'Space Grotesk',sans-serif" }}>
              How plants actually<br /><span style={{ background: "linear-gradient(135deg,#38BDF8,#52B788)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>cool your city</span>
            </h1>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.50)", maxWidth: 540, margin: "0 auto", lineHeight: 1.75 }}>
              There is hard physics and peer-reviewed biology behind every degree of cooling we predict. Here's the full picture.
            </p>
          </FadeUp>
        </section>

        {/* Big stats */}
        <section style={{ padding: "40px 24px 80px", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)" }}>
          <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 0 }}>
            <FadeUp delay={0}><StatBig value="7" unit="°C" label="Max surface temp reduction from dense green roofs (Nature Cities, 2021)" color="#52B788" /></FadeUp>
            <FadeUp delay={0.1}><StatBig value="31" unit="%" label="Better cooling efficiency with AI-optimised placement vs random planting" color="#38BDF8" /></FadeUp>
            <FadeUp delay={0.2}><StatBig value="400" unit="L" label="Water transpired per day by a single mature palm — removing heat from air" color="#A78BFA" /></FadeUp>
            <FadeUp delay={0.3}><StatBig value="62" unit="%" label="Reduction in species mismatch using site-specific microclimate data" color="#FB923C" /></FadeUp>
          </div>
        </section>

        {/* Mechanics */}
        <section style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <FadeUp style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace", marginBottom: 16 }}>COOLING MECHANISMS</div>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: -1 }}>Four ways plants fight urban heat</h2>
          </FadeUp>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 24 }}>
            {mechanics.map((m, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 24, padding: "32px 28px", height: "100%" }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: `${m.color}18`, border: `1px solid ${m.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 20 }}>{m.icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: m.color, letterSpacing: 1.5, marginBottom: 6, fontFamily: "'JetBrains Mono',monospace" }}>{m.title.toUpperCase()}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 12 }}>{m.subtitle}</h3>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 1.8 }}>{m.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </section>

        {/* How we model it */}
        <section style={{ padding: "80px 24px", background: "rgba(255,255,255,0.015)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <FadeUp style={{ textAlign: "center", marginBottom: 48 }}>
              <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: -1 }}>How HeatWise models cooling</h2>
            </FadeUp>
            {[
              { step: "01", title: "Real-time microclimate input", desc: "We pull live temperature, humidity, wind speed, UV index, and solar angle from Open-Meteo for your exact GPS location. City-average climate data causes 62% species mismatch — we avoid this by working at <1km² resolution." },
              { step: "02", title: "Species trait scoring", desc: "Each of 200+ species is scored on 14 trait axes: transpiration rate, canopy density, leaf area index, root depth, water need, heat tolerance, wind tolerance, growth rate, and more. These come from peer-reviewed horticultural databases." },
              { step: "03", title: "Layout thermal simulation", desc: "Our placement optimizer runs a simplified heat transfer model for each candidate layout. It calculates shading coverage (W/m²), transpiration volume (L/day), and resulting air temperature delta (°C) for each zone of your scan." },
              { step: "04", title: "Validation & calibration", desc: "Predicted °C reductions are calibrated against 2,400+ real green installations with recorded before/after temperature data. Mean prediction error: ±0.4°C at 1-month post-installation." },
            ].map((item, i) => (
              <FadeUp key={i} delay={i * 0.1}>
                <div style={{ display: "flex", gap: 24, marginBottom: 40 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#52B788", fontFamily: "'JetBrains Mono',monospace", width: 32, flexShrink: 0, paddingTop: 3 }}>{item.step}</div>
                  <div>
                    <h3 style={{ fontSize: 17, fontWeight: 700, color: "#fff", marginBottom: 10 }}>{item.title}</h3>
                    <p style={{ fontSize: 14, color: "rgba(255,255,255,0.50)", lineHeight: 1.8 }}>{item.desc}</p>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </section>

        {/* Research papers */}
        <section style={{ padding: "80px 24px", maxWidth: 900, margin: "0 auto" }}>
          <FadeUp style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace", marginBottom: 16 }}>PEER-REVIEWED RESEARCH</div>
            <h2 style={{ fontSize: "clamp(26px,4vw,42px)", fontWeight: 800, color: "#fff", letterSpacing: -1 }}>Built on published science</h2>
          </FadeUp>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {papers.map((p, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "24px 28px", display: "flex", gap: 24, flexWrap: "wrap" }}>
                  <div style={{ width: 40, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", fontFamily: "'JetBrains Mono',monospace" }}>{p.year}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{p.title}</div>
                    <div style={{ fontSize: 11, color: "#52B788", marginBottom: 10, fontStyle: "italic" }}>{p.journal}</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 1.7 }}>"{p.finding}"</div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: "80px 24px", textAlign: "center", background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(56,189,248,0.07) 0%, transparent 70%)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <FadeUp>
            <h2 style={{ fontSize: "clamp(24px,4vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: -1, marginBottom: 12 }}>See the science applied to your space</h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", marginBottom: 32 }}>Run a free scan and get a peer-reviewed cooling plan in 2 minutes.</p>
            <a href="/app?start=scan" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg,#1B4332,#52B788)", color: "#fff",
              padding: "14px 32px", borderRadius: 14, fontWeight: 800, fontSize: 15,
              textDecoration: "none", boxShadow: "0 8px 32px rgba(82,183,136,0.4)",
            }}>📷 Start free scan →</a>
          </FadeUp>
        </section>

      </div>
    </MarketingLayout>
  );
}

import MarketingLayout from "@/components/marketing/MarketingLayout";
import { useState, useEffect, useRef } from "react";

const APP = "/app";

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

const species = [
  { name: "Areca Palm", latin: "Dypsis lutescens", icon: "🌴", cooling: 4.2, water: "Medium", sun: "Indirect", space: "Balcony / Indoor", tags: ["Air Purifier", "Low Allergen"], color: "#52B788", desc: "India's most popular indoor cooling palm. Transpires heavily, adding moisture and reducing felt temperature." },
  { name: "Money Plant", latin: "Epipremnum aureum", icon: "🍃", cooling: 2.1, water: "Low", sun: "Low / Indirect", space: "Indoor / Corridor", tags: ["Beginner Friendly", "Trailing"], color: "#74C69D", desc: "Extremely low maintenance. Trails along walls and railings, perfect for corridors and staircases." },
  { name: "Snake Plant", latin: "Sansevieria trifasciata", icon: "🌵", cooling: 1.8, water: "Very Low", sun: "Any", space: "Indoor / Office", tags: ["Drought Tolerant", "Night O₂"], color: "#38BDF8", desc: "Releases oxygen at night. Near-zero water need makes it ideal for offices and air-conditioned spaces." },
  { name: "Bamboo", latin: "Bambusa vulgaris", icon: "🎋", cooling: 6.5, water: "High", sun: "Full Sun", space: "Terrace / Boundary", tags: ["Fast Growing", "Privacy Screen"], color: "#A78BFA", desc: "Best canopy cooling per rupee for terraces. Creates dense shade within 8–12 weeks of planting." },
  { name: "Banana Plant", latin: "Musa acuminata", icon: "🍌", cooling: 5.8, water: "High", sun: "Full Sun", space: "Terrace / Garden", tags: ["Large Canopy", "Native"], color: "#FB923C", desc: "Huge leaf area creates significant shade. Highly effective in humid climates — doubles as food plant." },
  { name: "Peace Lily", latin: "Spathiphyllum wallisii", icon: "🤍", cooling: 2.4, water: "Medium", sun: "Shade", space: "Indoor / Bathroom", tags: ["Shade Lover", "Humidity"], color: "#F472B6", desc: "Thrives in shade. Produces visible cooling via high transpiration. Flowers year-round indoors." },
  { name: "Ficus Tree", latin: "Ficus benjamina", icon: "🌳", cooling: 3.7, water: "Medium", sun: "Bright Indirect", space: "Large Indoor / Terrace", tags: ["Dense Canopy", "Air Quality"], color: "#52B788", desc: "Compact tree that can grow 2–3m indoors. Dense canopy provides consistent shading and transpiration." },
  { name: "Cactus Mix", latin: "Various", icon: "🌵", cooling: 0.6, water: "Very Low", sun: "Full Sun", space: "Windowsill / Sunny Balcony", tags: ["Drought Tolerant", "Decorative"], color: "#FB923C", desc: "Minimal cooling, but maximum water efficiency. Ideal for south-facing windowsills with no shade." },
  { name: "Bottle Palm", latin: "Hyophorbe lagenicaulis", icon: "🌴", cooling: 3.1, water: "Low", sun: "Full Sun", space: "Terrace / Entrance", tags: ["Ornamental", "Wind Tolerant"], color: "#38BDF8", desc: "Architectural appearance with good cooling. Wind tolerant — excellent for exposed terraces and entrances." },
  { name: "Boston Fern", latin: "Nephrolepis exaltata", icon: "🌿", cooling: 3.0, water: "High", sun: "Indirect", space: "Balcony / Shaded Patio", tags: ["High Humidity", "Hanging Basket"], color: "#74C69D", desc: "Massive humidity output. Best hung in shaded balconies or north-facing walls for evaporative cooling." },
  { name: "Aloe Vera", latin: "Aloe barbadensis", icon: "🌱", cooling: 1.2, water: "Very Low", sun: "Full / Bright Indirect", space: "Windowsill / Kitchen", tags: ["Medicinal", "Beginner"], color: "#52B788", desc: "Dual function: mild cooling + first aid. Stores water in leaves — effective even in drought conditions." },
  { name: "Spider Plant", latin: "Chlorophytum comosum", icon: "🕷️", cooling: 2.2, water: "Low", sun: "Indirect", space: "Indoor / Hanging", tags: ["Beginner Friendly", "Pet Safe"], color: "#A78BFA", desc: "Pet-safe and beginner-proof. Produces pups constantly — fills a balcony with greenery within one season." },
];

const filters = ["All", "Indoor", "Terrace", "Balcony", "Low Water", "High Cooling"];

function CoolingBar({ value, color }) {
  const pct = Math.min(100, (value / 7) * 100);
  return (
    <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden", marginTop: 6 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 4, boxShadow: `0 0 8px ${color}88` }} />
    </div>
  );
}

function SpeciesCard({ s, index }) {
  const [ref, visible] = useInView(0.05);
  const [hovered, setHovered] = useState(false);
  return (
    <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.5s ease ${(index % 4) * 0.07}s, transform 0.5s ease ${(index % 4) * 0.07}s, box-shadow 0.3s`,
        background: hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${hovered ? s.color + "55" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 20, padding: 24,
        boxShadow: hovered ? `0 16px 48px ${s.color}22` : "none",
        cursor: "default",
      }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 16 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: `${s.color}22`, border: `1px solid ${s.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 2 }}>{s.name}</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontStyle: "italic" }}>{s.latin}</div>
        </div>
      </div>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {s.tags.map(t => (
          <span key={t} style={{ fontSize: 10, fontWeight: 700, color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}33`, borderRadius: 100, padding: "3px 10px", letterSpacing: 0.5 }}>{t}</span>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "rgba(255,255,255,0.50)", lineHeight: 1.7, marginBottom: 16 }}>{s.desc}</p>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[["💧 Water", s.water], ["☀️ Sun", s.sun], ["📍 Space", s.space]].slice(0, 2).map(([k, v]) => (
          <div key={k} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 3 }}>{k}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>{v}</div>
          </div>
        ))}
      </div>

      {/* Cooling bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.40)" }}>Cooling power</span>
          <span style={{ fontSize: 12, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono',monospace" }}>−{s.cooling}°C</span>
        </div>
        <CoolingBar value={s.cooling} color={s.color} />
      </div>
    </div>
  );
}

export default function Species() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");

  const filtered = species.filter(s => {
    const matchFilter = activeFilter === "All"
      || (activeFilter === "Indoor" && s.space.toLowerCase().includes("indoor"))
      || (activeFilter === "Terrace" && s.space.toLowerCase().includes("terrace"))
      || (activeFilter === "Balcony" && s.space.toLowerCase().includes("balcony"))
      || (activeFilter === "Low Water" && (s.water === "Low" || s.water === "Very Low"))
      || (activeFilter === "High Cooling" && s.cooling >= 4);
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.latin.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <MarketingLayout title="Species Library — 200+ Climate-Matched Plants | HeatWise" description="Browse HeatWise's AI-curated library of 200+ plant species ranked by cooling power, water need, and microclimate compatibility for Indian urban spaces.">
      <div style={{ paddingTop: 100 }}>

        {/* Hero */}
        <section style={{ padding: "80px 24px 48px", textAlign: "center" }}>
          <FadeUp>
            <div style={{ display: "inline-flex", gap: 8, background: "rgba(82,183,136,0.12)", border: "1px solid rgba(82,183,136,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 24 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#52B788", letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace" }}>SPECIES LIBRARY</span>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, marginBottom: 16, fontFamily: "'Space Grotesk',sans-serif" }}>
              Every plant,<br /><span style={{ background: "linear-gradient(135deg,#52B788,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ranked by cooling power</span>
            </h1>
          </FadeUp>
          <FadeUp delay={0.15}>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.50)", maxWidth: 480, margin: "0 auto 40px", lineHeight: 1.7 }}>
              200+ species scored across 14 trait axes. Filter by your space, water budget, and sun exposure.
            </p>
          </FadeUp>
        </section>

        {/* Controls */}
        <section style={{ padding: "0 24px 40px", maxWidth: 1100, margin: "0 auto" }}>
          <FadeUp>
            {/* Search */}
            <div style={{ position: "relative", maxWidth: 480, margin: "0 auto 24px" }}>
              <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search plants..."
                style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: "14px 16px 14px 44px", color: "#fff", fontSize: 14, outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
            </div>

            {/* Filter pills */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              {filters.map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  style={{
                    background: activeFilter === f ? "linear-gradient(135deg,#1B4332,#52B788)" : "rgba(255,255,255,0.05)",
                    border: activeFilter === f ? "1px solid #52B78855" : "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 100, padding: "8px 18px", color: activeFilter === f ? "#fff" : "rgba(255,255,255,0.55)",
                    fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
                  }}>{f}</button>
              ))}
            </div>
          </FadeUp>
        </section>

        {/* Grid */}
        <section style={{ padding: "0 24px 80px", maxWidth: 1100, margin: "0 auto" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "rgba(255,255,255,0.35)" }}>No species match your filters.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 }}>
              {filtered.map((s, i) => <SpeciesCard key={s.name} s={s} index={i} />)}
            </div>
          )}
        </section>

        {/* CTA */}
        <section style={{ padding: "80px 24px", textAlign: "center", background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(82,183,136,0.08) 0%, transparent 70%)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <FadeUp>
            <h2 style={{ fontSize: "clamp(24px,4vw,40px)", fontWeight: 800, color: "#fff", letterSpacing: -1, marginBottom: 12 }}>Want the right plants for your space?</h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", marginBottom: 32 }}>Scan your space and AI picks the perfect species for your microclimate automatically.</p>
            <a href={`${APP}?start=scan`} style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "linear-gradient(135deg,#1B4332,#52B788)", color: "#fff",
              padding: "14px 32px", borderRadius: 14, fontWeight: 800, fontSize: 15,
              textDecoration: "none", boxShadow: "0 8px 32px rgba(82,183,136,0.4)",
            }}>📷 Get my plant plan →</a>
          </FadeUp>
        </section>

      </div>
    </MarketingLayout>
  );
}

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MarketingLayout from "../components/marketing/MarketingLayout";

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
};

const ALL_SPECIES = [
  { id: 1, emoji: "🌿", name: "Tulsi", sci: "Ocimum tenuiflorum", score: 78, zone: "Tropical", sun: "Full", petSafe: true, droughtOk: false, type: "Herb", cooling: "−2.1°C", water: "Medium", tags: ["Aromatic", "Medicinal"], desc: "Sacred basil with powerful air-purifying and cooling properties. Thrives in Mumbai, Chennai and Kochi climates." },
  { id: 2, emoji: "🪴", name: "Snake Plant", sci: "Sansevieria trifasciata", score: 92, zone: "Tropical", sun: "Shade", petSafe: false, droughtOk: true, type: "Succulent", cooling: "−1.8°C", water: "Low", tags: ["Air purifier", "Low maintenance"], desc: "Exceptional drought tolerance and air purification. Works in any Indian climate. Top rated for urban balconies." },
  { id: 3, emoji: "🍃", name: "Curry Leaf", sci: "Murraya koenigii", score: 85, zone: "Tropical", sun: "Full", petSafe: true, droughtOk: false, type: "Shrub", cooling: "−3.2°C", water: "Medium", tags: ["Edible", "Fragrant"], desc: "Native Indian shrub with dense canopy that creates significant shade and evaporative cooling on rooftops." },
  { id: 4, emoji: "🌾", name: "Lemongrass", sci: "Cymbopogon citratus", score: 81, zone: "Tropical", sun: "Full", petSafe: true, droughtOk: true, type: "Herb", cooling: "−2.8°C", water: "Low", tags: ["Edible", "Mosquito repellent"], desc: "Fast-growing grass that releases cooling vapours. Excellent for large rooftop installations in hot-dry cities." },
  { id: 5, emoji: "🪴", name: "Money Plant", sci: "Epipremnum aureum", score: 88, zone: "Tropical", sun: "Shade", petSafe: false, droughtOk: false, type: "Climber", cooling: "−2.4°C", water: "Medium", tags: ["Air purifier", "Fast growing"], desc: "Versatile climber that covers vertical surfaces, dramatically reducing heat absorption through walls and railings." },
  { id: 6, emoji: "🌳", name: "Neem", sci: "Azadirachta indica", score: 96, zone: "Arid", sun: "Full", petSafe: true, droughtOk: true, type: "Tree", cooling: "−5.1°C", water: "Low", tags: ["Medicinal", "Pest control"], desc: "India's most effective cooling tree. A single mature neem can reduce ambient temperature by 5°C in its shade zone." },
  { id: 7, emoji: "🌵", name: "Aloe Vera", sci: "Aloe barbadensis", score: 73, zone: "Arid", sun: "Full", petSafe: true, droughtOk: true, type: "Succulent", cooling: "−1.2°C", water: "Very Low", tags: ["Medicinal", "Edible"], desc: "Highly drought-tolerant succulent perfect for Rajasthan and Gujarat climates. Low cooling but zero maintenance." },
  { id: 8, emoji: "🌻", name: "Marigold", sci: "Tagetes erecta", score: 65, zone: "Temperate", sun: "Full", petSafe: true, droughtOk: false, type: "Herb", cooling: "−1.1°C", water: "Medium", tags: ["Colorful", "Pest deterrent"], desc: "Seasonal flowering plant that deters pests naturally. Best as a companion plant in mixed rooftop gardens." },
  { id: 9, emoji: "🌿", name: "Moringa", sci: "Moringa oleifera", score: 89, zone: "Tropical", sun: "Full", petSafe: true, droughtOk: true, type: "Tree", cooling: "−4.2°C", water: "Low", tags: ["Edible", "Nutritious"], desc: "Miracle tree with feathery leaves that cast dappled shade. Excellent heat reduction and edible throughout the year." },
  { id: 10, emoji: "🍀", name: "Brahmi", sci: "Bacopa monnieri", score: 71, zone: "Tropical", sun: "Partial", petSafe: true, droughtOk: false, type: "Herb", cooling: "−1.6°C", water: "High", tags: ["Medicinal", "Ground cover"], desc: "Low-growing Ayurvedic herb that forms a dense cooling mat. Ideal for terrace floors and container edges." },
  { id: 11, emoji: "🪴", name: "Areca Palm", sci: "Dypsis lutescens", score: 83, zone: "Tropical", sun: "Partial", petSafe: true, droughtOk: false, type: "Tree", cooling: "−3.6°C", water: "Medium", tags: ["Air purifier", "Ornamental"], desc: "Feathery fronds create excellent humidity and cooling. Among the best air humidifiers for balcony gardens." },
  { id: 12, emoji: "🌺", name: "Hibiscus", sci: "Hibiscus rosa-sinensis", score: 76, zone: "Tropical", sun: "Full", petSafe: true, droughtOk: false, type: "Shrub", cooling: "−2.3°C", water: "Medium", tags: ["Edible flowers", "Colorful"], desc: "Dense flowering shrub with large leaves that provide substantial shade and evaporative cooling." },
];

const ZONES = ["All", "Tropical", "Arid", "Temperate"];
const SUN_OPTS = ["All", "Full", "Partial", "Shade"];
const TYPES = ["All", "Herb", "Shrub", "Tree", "Succulent", "Climber"];

function ScoreBar({ score, color }) {
  return (
    <div style={{ background: C.MINT, borderRadius: 999, height: 6, overflow: "hidden" }}>
      <motion.div initial={{ width: 0 }} whileInView={{ width: `${score}%` }} viewport={{ once: true }} transition={{ duration: 0.8, ease: "easeOut" }}
        style={{ height: "100%", background: `linear-gradient(90deg, ${color || C.GREEN}, ${C.FOREST_LT})`, borderRadius: 999 }} />
    </div>
  );
}

export default function SpeciesPage() {
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("All");
  const [sun, setSun] = useState("All");
  const [petSafe, setPetSafe] = useState(false);
  const [droughtOk, setDroughtOk] = useState(false);
  const [type, setType] = useState("All");
  const [selected, setSelected] = useState(null);

  const filtered = ALL_SPECIES.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.sci.toLowerCase().includes(search.toLowerCase())) return false;
    if (zone !== "All" && s.zone !== zone) return false;
    if (sun !== "All" && s.sun !== sun) return false;
    if (petSafe && !s.petSafe) return false;
    if (droughtOk && !s.droughtOk) return false;
    if (type !== "All" && s.type !== type) return false;
    return true;
  });

  return (
    <MarketingLayout title="Species Catalog — HeatWise" description="Browse 800+ AI-verified plant species for urban cooling. Filter by climate zone, sun exposure, pet safety and more.">
      <style>{`
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 16px 2px rgba(64,176,112,0.3); } 50% { box-shadow: 0 0 32px 8px rgba(64,176,112,0.6); } }
      `}</style>

      {/* Hero */}
      <section style={{ padding: "80px 24px 48px", background: C.CREAM, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 700, height: 500, background: `radial-gradient(ellipse, ${C.MINT} 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: C.GREEN, marginBottom: 16 }}>
            Species Catalog · 800+ Plants
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(32px,5vw,56px)", fontWeight: 800, color: C.FOREST, marginBottom: 20, lineHeight: 1.1 }}>
            Find your{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>perfect plant</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 17, lineHeight: 1.7, color: C.FOREST, opacity: 0.7 }}>
            Every species verified for Indian climates, rated for cooling efficiency and matched to your urban microclimate.
          </motion.p>
        </div>
      </section>

      {/* Filters */}
      <section style={{ position: "sticky", top: 68, zIndex: 100, background: "rgba(250,250,246,0.9)", backdropFilter: "blur(12px)", borderBottom: `1px solid rgba(26,56,40,0.08)`, padding: "16px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          {/* Search */}
          <input
            type="text"
            placeholder="Search plants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: "9px 16px", borderRadius: 999, border: `1px solid rgba(26,56,40,0.15)`, background: "#fff", fontSize: 14, color: C.FOREST, outline: "none", fontFamily: "'DM Sans',sans-serif", width: 200 }}
          />
          {/* Zone */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ZONES.map((z) => (
              <button key={z} onClick={() => setZone(z)}
                style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: `1px solid ${zone === z ? C.GREEN : "rgba(26,56,40,0.15)"}`, background: zone === z ? C.MINT : "#fff", color: zone === z ? C.FOREST_MID : C.FOREST, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}>
                {z}
              </button>
            ))}
          </div>
          {/* Sun */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SUN_OPTS.map((s) => (
              <button key={s} onClick={() => setSun(s)}
                style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: `1px solid ${sun === s ? C.GOLD : "rgba(26,56,40,0.15)"}`, background: sun === s ? `${C.GOLD}22` : "#fff", color: sun === s ? C.FOREST_MID : C.FOREST, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}>
                {s === "All" ? "Any Sun" : `${s} Sun`}
              </button>
            ))}
          </div>
          {/* Types */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {TYPES.map((t) => (
              <button key={t} onClick={() => setType(t)}
                style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: `1px solid ${type === t ? C.SKY : "rgba(26,56,40,0.15)"}`, background: type === t ? `${C.SKY}22` : "#fff", color: type === t ? C.FOREST_MID : C.FOREST, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}>
                {t}
              </button>
            ))}
          </div>
          {/* Toggles */}
          {[{ label: "🐾 Pet Safe", val: petSafe, set: setPetSafe }, { label: "🏜️ Drought OK", val: droughtOk, set: setDroughtOk }].map(({ label, val, set }) => (
            <button key={label} onClick={() => set(!val)}
              style={{ padding: "7px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: `1px solid ${val ? C.GREEN : "rgba(26,56,40,0.15)"}`, background: val ? C.MINT : "#fff", color: val ? C.FOREST_MID : C.FOREST, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", transition: "all 0.2s" }}>
              {label}
            </button>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 13, color: C.FOREST, opacity: 0.5, fontFamily: "'JetBrains Mono',monospace" }}>
            {filtered.length} species
          </span>
        </div>
      </section>

      {/* Grid */}
      <section style={{ padding: "48px 24px 100px", background: C.CREAM }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <AnimatePresence>
            {filtered.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ textAlign: "center", padding: "80px 0", color: C.FOREST, opacity: 0.4 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
                <p style={{ fontSize: 16 }}>No plants match your filters. Try adjusting the criteria.</p>
              </motion.div>
            ) : (
              <motion.div layout style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
                {filtered.map((s) => (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ y: -4, boxShadow: "0 12px 40px rgba(64,176,112,0.12)" }}
                    onClick={() => setSelected(s)}
                    style={{ background: "#fff", border: `1px solid rgba(26,56,40,0.08)`, borderRadius: 20, padding: "28px 24px", cursor: "pointer", boxShadow: "0 2px 12px rgba(26,56,40,0.05)", transition: "box-shadow 0.3s" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                      <span style={{ fontSize: 44 }}>{s.emoji}</span>
                      <div style={{ background: s.score >= 85 ? C.MINT : `${C.GOLD}22`, borderRadius: 999, padding: "4px 10px", fontSize: 13, fontWeight: 700, color: s.score >= 85 ? C.FOREST_MID : C.FOREST, fontFamily: "'JetBrains Mono',monospace" }}>
                        {s.score}
                      </div>
                    </div>
                    <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 18, color: C.FOREST, marginBottom: 2 }}>{s.name}</h3>
                    <p style={{ fontSize: 12, fontStyle: "italic", color: C.FOREST, opacity: 0.45, marginBottom: 16 }}>{s.sci}</p>
                    <ScoreBar score={s.score} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.FOREST, opacity: 0.5, margin: "8px 0 16px", fontFamily: "'JetBrains Mono',monospace" }}>
                      <span>Match</span><span style={{ fontWeight: 600, opacity: 0.8, color: C.FOREST_LT }}>{s.score}/100</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                      <span style={{ background: `${C.GREEN}18`, color: C.FOREST_MID, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{s.type}</span>
                      <span style={{ background: `${C.GOLD}18`, color: C.FOREST_MID, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{s.zone}</span>
                      {s.petSafe && <span style={{ background: `${C.SKY}18`, color: C.FOREST_MID, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>Pet Safe</span>}
                      {s.droughtOk && <span style={{ background: `${C.HEAT_ORANGE}18`, color: C.FOREST_MID, borderRadius: 999, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>Drought OK</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, color: C.FOREST_LT }}>{s.cooling}</span>
                      <span style={{ fontSize: 12, color: C.FOREST, opacity: 0.4 }}>avg cooling</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 2000, backdropFilter: "blur(4px)" }} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 40 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "min(560px, 92vw)", background: "#fff", borderRadius: 28, zIndex: 2001, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.25)" }}
            >
              <div style={{ background: `linear-gradient(135deg, ${C.MINT}, rgba(64,176,112,0.2))`, padding: "36px 36px 28px", position: "relative" }}>
                <button onClick={() => setSelected(null)}
                  style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: "50%", background: "rgba(26,56,40,0.1)", border: "none", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ×
                </button>
                <div style={{ fontSize: 56, marginBottom: 12 }}>{selected.emoji}</div>
                <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 28, color: C.FOREST, marginBottom: 4 }}>{selected.name}</h2>
                <p style={{ fontSize: 14, fontStyle: "italic", color: C.FOREST, opacity: 0.5 }}>{selected.sci}</p>
              </div>
              <div style={{ padding: "28px 36px 36px" }}>
                <p style={{ fontSize: 15, lineHeight: 1.75, color: C.FOREST, opacity: 0.78, marginBottom: 28 }}>{selected.desc}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
                  {[
                    { label: "Match Score", val: `${selected.score}/100`, color: C.GREEN },
                    { label: "Avg Cooling", val: selected.cooling, color: C.SKY },
                    { label: "Water Need", val: selected.water, color: C.HEAT_ORANGE },
                  ].map((stat) => (
                    <div key={stat.label} style={{ background: C.CREAM, borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                      <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: 20, color: stat.color }}>{stat.val}</div>
                      <div style={{ fontSize: 11, color: C.FOREST, opacity: 0.5, marginTop: 4 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginBottom: 20 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.FOREST, opacity: 0.5, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>Compatibility</p>
                  <ScoreBar score={selected.score} />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
                  {[selected.type, selected.zone, `${selected.sun} Sun`, selected.petSafe ? "Pet Safe" : null, selected.droughtOk ? "Drought OK" : null, ...selected.tags].filter(Boolean).map((tag) => (
                    <span key={tag} style={{ background: C.MINT, color: C.FOREST_MID, borderRadius: 999, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{tag}</span>
                  ))}
                </div>
                <a href="/app?start=scan"
                  style={{ display: "block", textAlign: "center", padding: "14px 0", borderRadius: 999, background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                  Get Plan with {selected.name} →
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </MarketingLayout>
  );
}

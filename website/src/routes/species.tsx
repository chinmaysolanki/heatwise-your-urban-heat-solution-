import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Navbar } from "@/components/heatwise/Navbar";
import { Footer } from "@/components/heatwise/Footer";
import { SectionLabel } from "@/components/heatwise/SectionLabel";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";

export const Route = createFileRoute("/species")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Species Library — 800+ Cooling Plants for Urban Spaces" },
      { name: "description", content: "Search 800+ verified plants by cooling power, sun exposure, drought tolerance, pet safety, and more. Find the perfect species for your space." },
    ],
  }),
});

type Species = {
  emoji: string; name: string; sci: string; score: number;
  zone: "Tropical" | "Arid" | "Temperate";
  sun: "Full" | "Partial" | "Shade";
  pet: boolean; drought: boolean; type: "Herb" | "Shrub" | "Tree" | "Succulent" | "Climber";
  desc: string;
};

const DATA: Species[] = [
  { emoji: "🌿", name: "Tulsi", sci: "Ocimum sanctum", score: 78, zone: "Tropical", sun: "Full", pet: true, drought: false, type: "Herb", desc: "Sacred basil. Mosquito-repellent, medicinal, beautiful purple flowers." },
  { emoji: "🪴", name: "Snake Plant", sci: "Sansevieria trifasciata", score: 92, zone: "Arid", sun: "Partial", pet: false, drought: true, type: "Succulent", desc: "Architectural foliage, near-zero maintenance, releases oxygen at night." },
  { emoji: "🌱", name: "Curry Leaf", sci: "Murraya koenigii", score: 85, zone: "Tropical", sun: "Full", pet: true, drought: false, type: "Tree", desc: "Edible aromatic leaves, white flowers, beloved kitchen companion." },
  { emoji: "🌾", name: "Lemongrass", sci: "Cymbopogon citratus", score: 81, zone: "Tropical", sun: "Full", pet: true, drought: true, type: "Herb", desc: "Tall fragrant grass, repels mosquitoes, brews into citrus tea." },
  { emoji: "🍃", name: "Money Plant", sci: "Epipremnum aureum", score: 88, zone: "Tropical", sun: "Shade", pet: false, drought: false, type: "Climber", desc: "Trailing vine, purifies air, nearly indestructible indoor friend." },
  { emoji: "🌳", name: "Neem", sci: "Azadirachta indica", score: 96, zone: "Tropical", sun: "Full", pet: true, drought: true, type: "Tree", desc: "Deep shade, medicinal, natural pesticide, drought-hardy native." },
  { emoji: "🌵", name: "Aloe Vera", sci: "Aloe barbadensis", score: 73, zone: "Arid", sun: "Full", pet: false, drought: true, type: "Succulent", desc: "Healing gel, sculptural form, thrives on neglect and sun." },
  { emoji: "🌻", name: "Marigold", sci: "Tagetes erecta", score: 65, zone: "Tropical", sun: "Full", pet: true, drought: true, type: "Herb", desc: "Bright orange blooms, pollinator magnet, repels garden pests." },
  { emoji: "🌴", name: "Areca Palm", sci: "Dypsis lutescens", score: 90, zone: "Tropical", sun: "Partial", pet: true, drought: false, type: "Tree", desc: "Lush tropical canopy, top-tier humidifier, balcony cooling champion." },
  { emoji: "🪻", name: "Lavender", sci: "Lavandula angustifolia", score: 70, zone: "Temperate", sun: "Full", pet: true, drought: true, type: "Shrub", desc: "Calming scent, purple flower spikes, attracts bees, deters moths." },
  { emoji: "🌺", name: "Hibiscus", sci: "Hibiscus rosa-sinensis", score: 82, zone: "Tropical", sun: "Full", pet: true, drought: false, type: "Shrub", desc: "Showy blooms year-round, edible flowers, hummingbird favourite." },
  { emoji: "🪷", name: "Peace Lily", sci: "Spathiphyllum", score: 79, zone: "Tropical", sun: "Shade", pet: false, drought: false, type: "Herb", desc: "Glossy leaves, white spathes, top air-purifier for shaded corners." },
];

const FILTERS = {
  zone: ["Tropical", "Arid", "Temperate"] as const,
  sun: ["Full", "Partial", "Shade"] as const,
  pet: ["Pet Safe"] as const,
  drought: ["Drought OK"] as const,
  type: ["Herb", "Shrub", "Tree", "Succulent", "Climber"] as const,
};

function Page() {
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Species | null>(null);

  const toggle = (k: string) => {
    setActive((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  };

  const filtered = useMemo(() => {
    return DATA.filter((s) => {
      if (q && !`${s.name} ${s.sci}`.toLowerCase().includes(q.toLowerCase())) return false;
      for (const f of active) {
        if (FILTERS.zone.includes(f as typeof FILTERS.zone[number]) && s.zone !== f) return false;
        if (FILTERS.sun.includes(f as typeof FILTERS.sun[number]) && s.sun !== f) return false;
        if (f === "Pet Safe" && !s.pet) return false;
        if (f === "Drought OK" && !s.drought) return false;
        if (FILTERS.type.includes(f as typeof FILTERS.type[number]) && s.type !== f) return false;
      }
      return true;
    });
  }, [q, active]);

  return (
    <main>
      <Navbar />
      <section className="pt-40 pb-12 text-center px-6">
        <SectionLabel className="mx-auto justify-center">Species Library</SectionLabel>
        <h1 className="mt-4 font-display font-bold text-5xl md:text-7xl text-forest">
          800+ plants. <span className="text-gradient-green">Vetted by botanists.</span>
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-forest/65 text-lg">
          Filter by climate, sun, pet-safety and more. Tap any card for the full care guide.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        {/* Search */}
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-forest/45" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search 'tulsi', 'palm', 'shade'..."
            className="w-full glass-strong rounded-full pl-11 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-green/50 placeholder:text-forest/40"
          />
        </div>

        {/* Filter chips */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {[...FILTERS.zone, ...FILTERS.sun, ...FILTERS.pet, ...FILTERS.drought, ...FILTERS.type].map((f) => {
            const on = active.has(f);
            return (
              <button
                key={f}
                onClick={() => toggle(f)}
                className={`text-xs font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border transition ${
                  on
                    ? "bg-green text-[oklch(0.18_0.05_155)] border-green"
                    : "border-white/15 text-forest/65 hover:border-white/40"
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        <motion.div
          layout
          className="mt-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5"
        >
          <AnimatePresence>
            {filtered.map((s) => (
              <motion.button
                key={s.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ y: -6 }}
                onClick={() => setOpen(s)}
                className="text-left glass-strong rounded-2xl p-6 hover:border-green/40 transition"
              >
                <div className="text-5xl">{s.emoji}</div>
                <h3 className="mt-3 font-display text-lg font-semibold">{s.name}</h3>
                <p className="font-mono text-[11px] text-forest/45 italic">{s.sci}</p>
                <div className="mt-4">
                  <div className="flex justify-between text-[10px] font-mono text-forest/55 mb-1">
                    <span>COOLING</span><span className="text-green">{s.score}</span>
                  </div>
                  <div className="h-1 rounded-full bg-forest/10 overflow-hidden">
                    <div className="h-full bg-[var(--gradient-green)]" style={{ width: `${s.score}%` }} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {s.pet && <Tag>Pet</Tag>}
                  {s.drought && <Tag>Drought</Tag>}
                  <Tag>{s.zone}</Tag>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>

        {filtered.length === 0 && (
          <p className="text-center text-forest/55 mt-16">No species match those filters. Try removing a few.</p>
        )}
      </section>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setOpen(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg glass-strong rounded-3xl p-8"
            >
              <button onClick={() => setOpen(null)} className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-mint/40 hover:bg-mint/60">
                <X className="h-4 w-4" />
              </button>
              <div className="text-7xl">{open.emoji}</div>
              <h3 className="mt-4 font-display text-3xl font-bold">{open.name}</h3>
              <p className="font-mono text-sm text-forest/55 italic">{open.sci}</p>
              <p className="mt-4 text-forest/75 leading-relaxed">{open.desc}</p>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <Stat label="COOLING" value={open.score.toString()} />
                <Stat label="SUN" value={open.sun} />
                <Stat label="ZONE" value={open.zone} />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Footer />
    </main>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-forest/60 border border-white/10">
      {children}
    </span>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-mint/40 p-3">
      <div className="font-mono text-[10px] tracking-widest text-forest/45">{label}</div>
      <div className="font-display font-bold text-green mt-1">{value}</div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/heatwise/Navbar";
import { Footer } from "@/components/heatwise/Footer";
import { SectionLabel } from "@/components/heatwise/SectionLabel";
import { AnimatedSection, fadeUp } from "@/components/heatwise/AnimatedSection";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/blog")({
  component: Page,
  head: () => ({
    meta: [
      { title: "HeatWise Blog — Urban Heat, Plants & City Stories" },
      { name: "description", content: "Real stories, plant-care guides and research from the front line of urban cooling." },
    ],
  }),
});

const featured = {
  tag: "City Stories",
  title: "How a Mumbai apartment block dropped its summer AC bill by 18%",
  excerpt: "Crown Heights had 4 unused rooftops totalling 1,200m². Eight weeks later, an entire society felt the difference.",
  read: "8 min",
};

const posts = [
  { tag: "Heat Solutions", title: "5 plants that beat the Indian summer", read: "4 min", grad: "from-green/30 to-forest" },
  { tag: "Plant Care", title: "Watering schedules for terrace gardens", read: "6 min", grad: "from-sky/30 to-forest" },
  { tag: "City Stories", title: "Bengaluru's first society-wide green roof", read: "5 min", grad: "from-mint/30 to-forest-mid" },
  { tag: "Research", title: "Why native species cool 2.3× better", read: "7 min", grad: "from-gold/30 to-forest" },
  { tag: "Plant Care", title: "Monsoon prep: protecting your canopy", read: "5 min", grad: "from-green-pale/30 to-forest" },
  { tag: "Heat Solutions", title: "Apartment balcony? You can still cool 8m²", read: "3 min", grad: "from-green/30 to-bg-mid" },
];

const tagColor: Record<string, string> = {
  "Heat Solutions": "text-heat-orange",
  "Plant Care": "text-mint",
  "City Stories": "text-sky",
  "Research": "text-gold",
};

function Page() {
  return (
    <main>
      <Navbar />
      <section className="pt-40 pb-12 text-center px-6">
        <SectionLabel className="mx-auto justify-center">Stories</SectionLabel>
        <h1 className="mt-4 font-display font-bold text-5xl md:text-7xl text-forest">
          From the <span className="text-gradient-green">canopy</span>
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-forest/65 text-lg">
          Field reports, plant care, and the science of cooling cities — one rooftop at a time.
        </p>
      </section>

      <AnimatedSection className="py-12">
        <div className="mx-auto max-w-7xl px-6">
          {/* Featured */}
          <motion.article variants={fadeUp} className="relative overflow-hidden rounded-3xl glass-strong group cursor-pointer grid lg:grid-cols-2 gap-0">
            <div className="relative aspect-[16/10] lg:aspect-auto bg-gradient-to-br from-green/30 via-forest to-bg-dark grid place-items-center">
              <div className="absolute inset-0 grain" />
              <div className="text-9xl">🏙️</div>
            </div>
            <div className="p-8 md:p-12 flex flex-col justify-center">
              <span className={`font-mono text-xs uppercase tracking-widest ${tagColor[featured.tag]}`}>{featured.tag} · Featured</span>
              <h2 className="mt-4 font-display font-bold text-3xl md:text-4xl group-hover:text-gradient-green transition">{featured.title}</h2>
              <p className="mt-4 text-forest/65 leading-relaxed">{featured.excerpt}</p>
              <div className="mt-6 flex items-center gap-3 text-sm text-forest/55 font-mono">
                <span>{featured.read} read</span>
                <span>·</span>
                <span>April 2026</span>
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </motion.article>

          {/* Grid */}
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((p) => (
              <motion.article
                key={p.title}
                variants={fadeUp}
                whileHover={{ y: -6 }}
                className="group glass rounded-2xl overflow-hidden cursor-pointer"
              >
                <div className={`aspect-[16/10] bg-gradient-to-br ${p.grad} relative grain`}>
                  <div className="absolute bottom-3 left-3 glass rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider">
                    {p.tag}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-display text-lg font-semibold leading-snug group-hover:text-gradient-green transition">
                    {p.title}
                  </h3>
                  <div className="mt-3 text-xs font-mono text-forest/45">{p.read} read</div>
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <Footer />
    </main>
  );
}

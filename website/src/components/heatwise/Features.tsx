import { AnimatedSection, fadeUp } from "./AnimatedSection";
import { GlassCard } from "./GlassCard";
import { SectionLabel } from "./SectionLabel";
import { motion } from "framer-motion";
import { Thermometer, Cpu, BarChart3, Sprout, HardHat, Smartphone } from "lucide-react";

const features = [
  { icon: Thermometer, title: "Live heat detection", desc: "Real-time climate data from Open-Meteo. Updated every 15 minutes for your exact location." },
  { icon: Cpu, title: "AI layout engine", desc: "Species placement optimised for your specific heat zone, sun hours and structural load." },
  { icon: BarChart3, title: "Cooling impact score", desc: "See estimated °C reduction, humidity gain and CO₂ offset before you plant." },
  { icon: Sprout, title: "800+ verified species", desc: "Drought-tolerant, pet-safe, regional-native — every plant vetted by botanists." },
  { icon: HardHat, title: "Installer network", desc: "Verified green-space contractors in 14 cities. Insured, rated, fixed-price quotes." },
  { icon: Smartphone, title: "Works on any device", desc: "Scan from phone, manage from desktop. Sync across iOS, Android and web." },
];

export function Features() {
  return (
    <AnimatedSection className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <motion.div variants={fadeUp} className="max-w-2xl">
          <SectionLabel>03 — Capabilities</SectionLabel>
          <h2 className="mt-4 font-display font-bold text-4xl md:text-6xl text-forest">
            Everything your <span className="text-gradient-green">garden</span> needs
          </h2>
        </motion.div>

        <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f) => (
            <motion.div key={f.title} variants={fadeUp}>
              <GlassCard className="h-full">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-green/10 text-green">
                  <f.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-xl font-semibold mt-5 text-forest">{f.title}</h3>
                <p className="text-forest/60 text-sm mt-2 leading-relaxed">{f.desc}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}

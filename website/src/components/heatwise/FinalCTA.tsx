import { motion } from "framer-motion";
import { GreenButton } from "./GreenButton";
import { Camera } from "lucide-react";

export function FinalCTA() {
  const particles = Array.from({ length: 40 }).map((_, i) => ({
    x: (i * 137) % 100,
    y: (i * 53) % 100,
    s: 1 + (i % 4),
    d: 4 + (i % 6),
  }));

  return (
    <section className="relative py-32 overflow-hidden dark-section">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.42_0.08_155)_0%,oklch(0.27_0.05_155)_55%,oklch(0.18_0.04_155)_100%)]" />
      <div className="absolute inset-0 grain" />

      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-green-pale/60"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s }}
          animate={{
            y: [-20, -80],
            opacity: [0, 0.7, 0],
          }}
          transition={{
            duration: p.d,
            repeat: Infinity,
            delay: (i % 8) * 0.4,
            ease: "easeOut",
          }}
        />
      ))}

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="font-display font-bold text-5xl md:text-7xl text-white"
        >
          Your rooftop is{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, oklch(0.92 0.06 152), oklch(0.78 0.13 152))" }}
          >
            waiting
          </span>
          .
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="mt-6 text-white/75 text-lg md:text-xl"
        >
          Join 2,800+ households already cooling their city. One scan. One plan. Real degrees.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <GreenButton variant="pulse" className="text-base px-8 py-4">
            <Camera className="h-4 w-4" /> Start Your Free Scan →
          </GreenButton>
          <GreenButton variant="dark-ghost" className="px-8 py-4">
            Talk to our team
          </GreenButton>
        </motion.div>
      </div>
    </section>
  );
}

import { motion } from "framer-motion";

const logos = [
  "Times of India",
  "YourStory",
  "Smart Cities India",
  "NDTV",
  "IIT Bombay",
  "The Hindu",
  "Inc42",
  "Forbes India",
];

export function SocialProof() {
  return (
    <section className="relative border-y border-forest/8 bg-white/50 py-10 overflow-hidden">
      <p className="text-center text-xs md:text-sm font-mono uppercase tracking-[0.2em] text-forest/55 mb-6">
        Trusted by urban farmers, housing societies & city planners across India
      </p>
      <div className="relative overflow-hidden">
        <motion.div
          className="flex gap-16 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {[...logos, ...logos].map((l, i) => (
            <span
              key={i}
              className="font-display text-xl md:text-2xl font-medium text-forest/30 hover:text-forest/60 transition shrink-0"
            >
              {l}
            </span>
          ))}
        </motion.div>
        {/* Edge fades */}
        <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-cream to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-cream to-transparent pointer-events-none" />
      </div>
    </section>
  );
}

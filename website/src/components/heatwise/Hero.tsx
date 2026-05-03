import { motion } from "framer-motion";
import { GreenButton } from "./GreenButton";
import { Camera, Play, Snowflake, Sprout, Zap, Star, ArrowRight } from "lucide-react";
import { HeroCityReveal } from "./HeroCityReveal";

const HEADLINE = "Turn urban heat into a living green canopy";

export function Hero() {
  const words = HEADLINE.split(" ");

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden grain">
      {/* Soft background ornaments */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full bg-mint/40 blur-3xl opacity-70" />
        <div className="absolute top-40 -right-32 w-[400px] h-[400px] rounded-full bg-green/20 blur-3xl" />
        <div className="absolute top-60 -left-32 w-[400px] h-[400px] rounded-full bg-heat-orange/15 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        {/* Announcement pill */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mx-auto w-fit flex items-center gap-2 rounded-full bg-white/80 backdrop-blur-md border border-forest/10 px-3 py-1 text-xs md:text-sm shadow-[0_4px_14px_-6px_oklch(0.30_0.06_155/0.15)]"
        >
          <span className="grid place-items-center h-5 w-5 rounded-full bg-green/15 text-green">
            <Sprout className="h-3 w-3" />
          </span>
          <span className="text-forest/75">Live in 14 cities · 2,800+ rooftops greened</span>
          <ArrowRight className="h-3 w-3 text-forest/40" />
        </motion.div>

        <div className="mt-8 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left: Copy */}
          <div className="lg:col-span-7 text-center lg:text-left">
            <h1 className="font-display font-bold tracking-tight text-5xl sm:text-6xl lg:text-7xl xl:text-[5.25rem] leading-[1.02] text-forest">
              {words.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.25 + i * 0.05,
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="inline-block mr-[0.25em]"
                >
                  {word === "green" || word === "living" ? (
                    <span className="text-gradient-green">{word}</span>
                  ) : (
                    word
                  )}
                </motion.span>
              ))}
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.85, duration: 0.6 }}
              className="mt-6 max-w-xl mx-auto lg:mx-0 text-base md:text-lg text-forest/65 leading-relaxed"
            >
              AI-matched plants. Climate-aware layouts. Real cooling — measured in degrees.
              Transform any rooftop, balcony or terrace in minutes.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="mt-9 flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-3"
            >
              <GreenButton variant="primary" className="text-base px-7 py-3.5">
                <Camera className="h-4 w-4" /> Scan My Space
              </GreenButton>
              <GreenButton variant="ghost" className="px-7 py-3.5">
                <Play className="h-4 w-4 fill-current" /> Watch 90s Demo
              </GreenButton>
            </motion.div>

            {/* Trust row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="mt-8 flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-4 text-sm text-forest/60"
            >
              <div className="flex -space-x-2">
                {["AM", "RK", "PS", "+"].map((n, i) => (
                  <div
                    key={i}
                    className={`grid h-8 w-8 place-items-center rounded-full text-[11px] font-bold border-2 border-cream ${
                      i === 3 ? "bg-forest text-white" : "bg-[var(--gradient-green)] text-white"
                    }`}
                  >
                    {n}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-0.5 text-gold">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-current" />
                  ))}
                </div>
                <span><span className="font-semibold text-forest">4.9/5</span> from 2,800+ households</span>
              </div>
            </motion.div>
          </div>

          {/* Right: 3D card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5 relative"
          >
            <div className="relative aspect-[4/5] sm:aspect-[5/5] rounded-3xl overflow-hidden bg-gradient-to-br from-mint via-white to-cream border border-forest/8 shadow-[0_30px_80px_-20px_oklch(0.30_0.06_155/0.25)]">
              <HeroCityReveal />
              {/* Subtle vignette */}
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_120%,oklch(0.30_0.06_155/0.25),transparent_50%)]" />

              {/* Live data card overlay */}
              <div className="absolute top-4 left-4 bg-white/85 backdrop-blur-md border border-forest/10 rounded-xl px-3 py-2 shadow-md">
                <div className="font-mono text-[9px] tracking-widest text-forest/55">LIVE · MUMBAI</div>
                <div className="flex items-baseline gap-2">
                  <div className="font-display text-lg font-bold text-heat-red">42.7°C</div>
                  <div className="text-[10px] text-forest/50">surface</div>
                </div>
              </div>

              {/* Cooling card */}
              <div className="absolute bottom-4 right-4 bg-white/85 backdrop-blur-md border border-forest/10 rounded-xl px-3 py-2 shadow-md">
                <div className="font-mono text-[9px] tracking-widest text-green">AFTER GREENING</div>
                <div className="flex items-baseline gap-2">
                  <div className="font-display text-lg font-bold text-green">−4.2°C</div>
                  <div className="text-[10px] text-forest/50">avg drop</div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0 }}
              className="hidden md:flex absolute -left-4 top-1/3 bg-white border border-forest/10 rounded-full px-3 py-2 items-center gap-2 text-xs font-mono shadow-md animate-bob"
            >
              <Snowflake className="h-3.5 w-3.5 text-sky" />
              <span className="text-forest">−4.2°C avg</span>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2 }}
              className="hidden md:flex absolute -right-4 bottom-1/4 bg-white border border-forest/10 rounded-full px-3 py-2 items-center gap-2 text-xs font-mono shadow-md animate-bob"
              style={{ animationDelay: "0.5s" }}
            >
              <Zap className="h-3.5 w-3.5 text-gold" />
              <span className="text-forest">AI in minutes</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

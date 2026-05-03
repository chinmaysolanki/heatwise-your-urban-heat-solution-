import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Navbar } from "@/components/heatwise/Navbar";
import { Footer } from "@/components/heatwise/Footer";
import { SectionLabel } from "@/components/heatwise/SectionLabel";
import { GreenButton } from "@/components/heatwise/GreenButton";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, MapPin, Sprout } from "lucide-react";

export const Route = createFileRoute("/contact")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Contact HeatWise — Talk to a Green Advisor" },
      { name: "description", content: "Questions, partnership requests, press? We respond within one business day." },
    ],
  }),
});

const roles = ["Homeowner", "Society", "Installer", "Press"] as const;

function Page() {
  const [role, setRole] = useState<typeof roles[number]>("Homeowner");
  const [sent, setSent] = useState(false);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <main>
      <Navbar />
      <section className="pt-40 pb-12 text-center px-6">
        <SectionLabel className="mx-auto justify-center">Get in touch</SectionLabel>
        <h1 className="mt-4 font-display font-bold text-5xl md:text-7xl text-forest">
          Let's grow <span className="text-gradient-green">together</span>
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-forest/65 text-lg">
          Questions, partnerships, or press — we reply within one business day.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Form */}
          <div className="glass-strong rounded-3xl p-8 md:p-10">
            <AnimatePresence mode="wait">
              {!sent ? (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={onSubmit}
                  className="space-y-5"
                >
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Name" type="text" required />
                    <Field label="Email" type="email" required />
                  </div>
                  <Field label="City" type="text" required />
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-forest/55">I'm a:</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {roles.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRole(r)}
                          className={`text-xs font-mono uppercase tracking-wider px-4 py-2 rounded-full border transition ${
                            role === r
                              ? "bg-green text-[oklch(0.18_0.05_155)] border-green"
                              : "border-white/15 text-forest/65 hover:border-white/40"
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="font-mono text-xs uppercase tracking-widest text-forest/55">Message</label>
                    <textarea
                      required
                      rows={5}
                      className="mt-2 w-full rounded-xl bg-mint/30 border border-forest/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green/50 placeholder:text-forest/35"
                      placeholder="Tell us about your space, your goals, or your question..."
                    />
                  </div>
                  <GreenButton type="submit" className="w-full">
                    Send message →
                  </GreenButton>
                </motion.form>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-12 relative overflow-hidden"
                >
                  {/* Confetti */}
                  {Array.from({ length: 30 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="absolute text-2xl"
                      initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
                      animate={{
                        x: (Math.random() - 0.5) * 600,
                        y: (Math.random() - 0.5) * 400,
                        opacity: 0,
                        rotate: Math.random() * 720,
                      }}
                      transition={{ duration: 1.6, ease: "easeOut" }}
                      style={{ left: "50%", top: "30%" }}
                    >
                      {["🌿", "🌱", "🍃", "🌾"][i % 4]}
                    </motion.span>
                  ))}
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[var(--gradient-green)] text-[oklch(0.18_0.05_155)]">
                    <Sprout className="h-8 w-8" />
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-bold">Message sent! 🌿</h3>
                  <p className="mt-2 text-forest/65">We'll be in touch within one business day.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Illustration / info */}
          <div className="space-y-6">
            <div className="relative aspect-square rounded-3xl glass-strong overflow-hidden grid place-items-center grain">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,oklch(0.55_0.11_155/0.5),transparent_60%)]" />
              <div className="grid grid-cols-4 gap-3 p-8 relative">
                {Array.from({ length: 16 }).map((_, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="grid place-items-center text-4xl rounded-xl glass aspect-square"
                  >
                    {["🌿", "🌱", "🪴", "🌾", "🍃", "🌳"][i % 6]}
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <InfoCard icon={<Mail className="h-4 w-4" />} label="Email" value="hello@heatwise.in" />
              <InfoCard icon={<MapPin className="h-4 w-4" />} label="Studio" value="Mumbai · India" />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="font-mono text-xs uppercase tracking-widest text-forest/55">{label}</label>
      <input
        {...props}
        className="mt-2 w-full rounded-xl bg-mint/30 border border-forest/10 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green/50 placeholder:text-forest/35"
      />
    </div>
  );
}
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-green">{icon}<span className="font-mono text-[10px] uppercase tracking-widest">{label}</span></div>
      <div className="mt-2 font-display font-medium">{value}</div>
    </div>
  );
}

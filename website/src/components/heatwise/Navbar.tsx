import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X, Leaf } from "lucide-react";
import { GreenButton } from "./GreenButton";
import { motion, AnimatePresence } from "framer-motion";

const links = [
  { to: "/how-it-works", label: "How it Works" },
  { to: "/species", label: "Species" },
  { to: "/science", label: "Science" },
  { to: "/#pricing", label: "Pricing" },
  { to: "/blog", label: "Blog" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? "py-2.5" : "py-4"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 md:px-6">
        <nav
          className={`flex items-center justify-between rounded-2xl px-4 md:px-5 py-2.5 transition-all ${
            scrolled
              ? "bg-white/80 backdrop-blur-xl border border-forest/10 shadow-[0_8px_30px_-10px_oklch(0.30_0.06_155/0.12)]"
              : "bg-transparent"
          }`}
        >
          <Link to="/" className="flex items-center gap-2 group">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--gradient-green)] text-white shadow-[0_6px_20px_-6px_oklch(0.65_0.16_152/0.6)] group-hover:scale-105 transition-transform">
              <Leaf className="h-5 w-5" />
            </span>
            <span className="font-display font-bold text-xl tracking-tight text-forest">HeatWise</span>
          </Link>

          <ul className="hidden lg:flex items-center gap-7 text-sm text-forest/70">
            {links.map((l) => (
              <li key={l.to}>
                <Link
                  to={l.to}
                  className="hover:text-forest transition-colors relative after:content-[''] after:absolute after:left-0 after:-bottom-1 after:h-px after:w-0 after:bg-green after:transition-all hover:after:w-full"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden lg:block">
            <GreenButton variant="primary" className="px-5 py-2.5 text-sm">
              Start Free Scan →
            </GreenButton>
          </div>

          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden grid h-10 w-10 place-items-center rounded-xl bg-white/80 border border-forest/10"
          >
            {open ? <X className="h-5 w-5 text-forest" /> : <Menu className="h-5 w-5 text-forest" />}
          </button>
        </nav>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.3 }}
            className="lg:hidden fixed inset-y-0 right-0 w-72 bg-white shadow-2xl p-6 pt-24 z-40"
          >
            <ul className="flex flex-col gap-5 text-lg text-forest">
              {links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="hover:text-green"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <GreenButton className="w-full">Start Free Scan →</GreenButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

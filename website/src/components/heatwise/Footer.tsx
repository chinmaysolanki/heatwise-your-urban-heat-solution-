import { Link } from "@tanstack/react-router";
import { Leaf, Twitter, Instagram, Linkedin, Youtube } from "lucide-react";

const cols = [
  {
    title: "Product",
    links: [
      { label: "How it Works", to: "/how-it-works" },
      { label: "Species Library", to: "/species" },
      { label: "Pricing", to: "/#pricing" },
      { label: "For Societies", to: "/#pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Science", to: "/science" },
      { label: "Blog", to: "/blog" },
      { label: "Contact", to: "/contact" },
      { label: "Press", to: "/contact" },
    ],
  },
  {
    title: "Connect",
    links: [
      { label: "Installer Network", to: "/contact" },
      { label: "Partner with Us", to: "/contact" },
      { label: "Help Center", to: "/contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-forest/10 bg-white/60 mt-0">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--gradient-green)] text-white">
                <Leaf className="h-5 w-5" />
              </span>
              <span className="font-display font-bold text-xl text-forest">HeatWise</span>
            </Link>
            <p className="mt-4 text-sm text-forest/60 max-w-xs">
              AI-powered green canopies for cooler cities. One rooftop at a time.
            </p>
            <div className="mt-6 flex gap-3">
              {[Twitter, Instagram, Linkedin, Youtube].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  aria-label="social"
                  className="grid h-9 w-9 place-items-center rounded-lg bg-white border border-forest/10 text-forest/70 hover:text-green hover:border-green/40 transition"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-green mb-4">
                {col.title}
              </h4>
              <ul className="flex flex-col gap-3 text-sm text-forest/70">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="hover:text-green transition">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 pt-6 border-t border-forest/10 flex flex-col md:flex-row justify-between gap-4 text-xs text-forest/50">
          <p>Built with 🌿 for cooler cities · HeatWise © 2026</p>
          <p>Made in India · Open-Meteo data partner</p>
        </div>
      </div>
    </footer>
  );
}

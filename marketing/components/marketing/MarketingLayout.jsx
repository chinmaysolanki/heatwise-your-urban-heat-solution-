import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { APP_URL, CONTACT_EMAIL, INSTALLER_EMAIL, PRESS_EMAIL } from "../../lib/config";

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
  BG_MID: "#182a20",
};

const NAV_LINKS = [
  { label: "How it Works", href: "/how-it-works" },
  { label: "Species", href: "/species" },
  { label: "Science", href: "/science" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Blog", href: "/blog" },
];

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{`
        @keyframes bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 16px 2px rgba(64,176,112,0.3); }
          50% { box-shadow: 0 0 32px 8px rgba(64,176,112,0.6); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes scanLine {
          0% { top: 0; opacity: 1; }
          95% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: ${C.CREAM}; color: ${C.FOREST}; font-family: 'DM Sans', sans-serif; }
        :root {
          --cream: ${C.CREAM};
          --forest: ${C.FOREST};
          --forest-mid: ${C.FOREST_MID};
          --forest-lt: ${C.FOREST_LT};
          --green: ${C.GREEN};
          --green-pale: ${C.GREEN_PALE};
          --mint: ${C.MINT};
          --sky: ${C.SKY};
          --gold: ${C.GOLD};
          --heat-red: ${C.HEAT_RED};
          --heat-orange: ${C.HEAT_ORANGE};
          --bg-dark: ${C.BG_DARK};
          --bg-mid: ${C.BG_MID};
        }
        a { text-decoration: none; color: inherit; }
        button { cursor: pointer; border: none; background: none; font-family: inherit; }
      `}</style>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          transition: "background 0.3s, backdrop-filter 0.3s, box-shadow 0.3s",
          background: scrolled ? "rgba(255,255,255,0.85)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          boxShadow: scrolled ? "0 1px 24px rgba(26,56,40,0.07)" : "none",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "0 24px",
            height: 68,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 24,
                background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              🌿
            </span>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 20,
                background: `linear-gradient(135deg, ${C.FOREST_MID}, ${C.GREEN})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              HeatWise
            </span>
          </Link>

          {/* Desktop Links */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 32,
            }}
            className="desktop-nav"
          >
            <style>{`
              @media (max-width: 768px) { .desktop-nav { display: none !important; } }
            `}</style>
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 500,
                  fontSize: 15,
                  color: C.FOREST,
                  opacity: 0.8,
                  transition: "opacity 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.8")}
              >
                {l.label}
              </Link>
            ))}
            <NavCTA />
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              display: "none",
              flexDirection: "column",
              gap: 5,
              padding: 4,
            }}
            className="hamburger"
            aria-label="Menu"
          >
            <style>{`
              @media (max-width: 768px) { .hamburger { display: flex !important; } }
            `}</style>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: "block",
                  width: 22,
                  height: 2,
                  background: C.FOREST,
                  borderRadius: 2,
                  transition: "transform 0.2s",
                }}
              />
            ))}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.3)",
                zIndex: 998,
              }}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                bottom: 0,
                width: 280,
                background: C.CREAM,
                zIndex: 999,
                padding: "80px 32px 32px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                boxShadow: "-8px 0 32px rgba(26,56,40,0.12)",
              }}
            >
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: C.FOREST,
                    padding: "12px 0",
                    borderBottom: `1px solid ${C.MINT}`,
                  }}
                >
                  {l.label}
                </Link>
              ))}
              <div style={{ marginTop: 24 }}>
                <NavCTA />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function NavCTA() {
  const [hovered, setHovered] = useState(false);
  return (
    <Link
      href={APP_URL}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered
          ? `linear-gradient(135deg, ${C.FOREST_MID}, ${C.GREEN})`
          : `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`,
        color: "#fff",
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        padding: "10px 20px",
        borderRadius: 999,
        transition: "all 0.3s",
        whiteSpace: "nowrap",
        display: "inline-block",
        backgroundSize: "200% auto",
      }}
    >
      Start Free Scan →
    </Link>
  );
}

function Footer() {
  const footerLinks = {
    Product: [
      { label: "How it Works", href: "/how-it-works" },
      { label: "Species Catalog", href: "/species" },
      { label: "Science", href: "/science" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Contact", href: "/contact" },
    ],
    Company: [
      { label: "Science", href: "/science" },
      { label: "Blog", href: "/blog" },
      { label: "Press Kit", href: `/contact` },
      { label: "Become an Installer", href: `/contact` },
      { label: "About Us", href: "/contact" },
    ],
    Connect: [
      { label: "General Enquiry", href: `mailto:${CONTACT_EMAIL}` },
      { label: "Installer Network", href: `mailto:${INSTALLER_EMAIL}` },
      { label: "Press & Media", href: `mailto:${PRESS_EMAIL}` },
    ],
  };

  return (
    <footer style={{ background: C.BG_DARK, color: "#e0f5e8" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 24px 0" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 48,
            paddingBottom: 48,
            borderBottom: "1px solid rgba(224,245,232,0.1)",
          }}
        >
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 24 }}>🌿</span>
              <span
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 20,
                  color: C.GREEN_PALE,
                }}
              >
                HeatWise
              </span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, opacity: 0.7, marginBottom: 20 }}>
              AI-powered urban greening that turns rooftops into cooling engines — one plant at a time.
            </p>
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ fontSize: 13, color: C.GREEN_PALE, opacity: 0.7, display: "block", marginBottom: 4 }}>{CONTACT_EMAIL}</a>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([col, links]) => (
            <div key={col}>
              <h4
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: C.GREEN_PALE,
                  marginBottom: 16,
                }}
              >
                {col}
              </h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      style={{ fontSize: 14, opacity: 0.65, transition: "opacity 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.65")}
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            padding: "20px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            opacity: 0.5,
            textAlign: "center",
          }}
        >
          Built with 🌿 for cooler cities · HeatWise © 2026 · Made in India · Open-Meteo data partner
        </div>
      </div>
    </footer>
  );
}

export default function MarketingLayout({ children, title = "HeatWise — Urban Cooling by AI", description = "AI-matched plants, climate-aware layouts, real cooling measured in degrees." }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>
      <Navbar />
      <main style={{ paddingTop: 68 }}>{children}</main>
      <Footer />
    </>
  );
}

import { useState, useEffect } from "react";
import Link from "next/link";
import Head from "next/head";

const APP = "/app";

/* ── Nav ──────────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { href: "/how-it-works", label: "How it Works" },
    { href: "/species",      label: "Species" },
    { href: "/science",      label: "Science" },
    { href: "/#pricing",     label: "Pricing" },
    { href: "/contact",      label: "Contact" },
  ];

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
      background: scrolled ? "rgba(4,12,24,0.92)" : "transparent",
      backdropFilter: scrolled ? "blur(20px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(255,255,255,0.07)" : "none",
      transition: "all 0.3s ease",
      padding: "0 24px",
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#1B4332,#52B788)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌿</div>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.5, fontFamily: "'Space Grotesk',sans-serif" }}>HeatWise</span>
        </Link>

        {/* Desktop links */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }} className="nav-desktop">
          {links.map(l => (
            <Link key={l.href} href={l.href} style={{ fontSize: 14, fontWeight: 600, color: "rgba(255,255,255,0.70)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => e.target.style.color = "#fff"}
              onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.70)"}
            >{l.label}</Link>
          ))}
        </div>

        {/* CTA */}
        <a href={`${APP}?start=scan`} style={{
          background: "linear-gradient(135deg,#1B4332,#52B788)",
          color: "#fff", padding: "10px 20px", borderRadius: 12,
          fontWeight: 800, fontSize: 13, textDecoration: "none",
          display: "flex", alignItems: "center", gap: 6,
          boxShadow: "0 4px 20px rgba(82,183,136,0.35)",
          transition: "all 0.2s ease",
        }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(82,183,136,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(82,183,136,0.35)"; }}
        >
          📷 Open App
        </a>
      </div>

      <style>{`
        @media(max-width:768px){ .nav-desktop{ display:none !important; } }
      `}</style>
    </nav>
  );
}

/* ── Mobile App Banner ────────────────────────────────────── */
function MobileBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => { if (window.innerWidth < 768) setShow(true); }, []);
  if (!show) return null;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 999,
      background: "linear-gradient(135deg,#1B4332,#2D6A4F)",
      padding: "12px 16px 20px",
      display: "flex", alignItems: "center", gap: 10,
      borderTop: "1px solid rgba(255,255,255,0.1)",
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🌿</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>HeatWise App</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.60)" }}>Scan your space in minutes</div>
      </div>
      <a href={`${APP}?start=scan`} style={{ background: "#fff", color: "#1B4332", padding: "8px 16px", borderRadius: 20, fontWeight: 800, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}>
        Open →
      </a>
      <button onClick={() => setShow(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.45)", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>×</button>
    </div>
  );
}

/* ── Footer ───────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { title: "Product", links: [{ label: "How it Works", href: "/how-it-works" }, { label: "Species Library", href: "/species" }, { label: "Pricing", href: "/#pricing" }, { label: "For Societies", href: "/contact" }] },
    { title: "Company",  links: [{ label: "Science", href: "/science" }, { label: "Blog", href: "/blog" }, { label: "Contact", href: "/contact" }, { label: "Press", href: "/contact" }] },
    { title: "Connect",  links: [{ label: "Installer Network", href: "/contact" }, { label: "Partner with Us", href: "/contact" }, { label: "Help Center", href: "/contact" }] },
  ];
  return (
    <footer style={{ background: "#020810", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "60px 24px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, marginBottom: 48 }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#1B4332,#52B788)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🌿</div>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Space Grotesk',sans-serif" }}>HeatWise</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.40)", lineHeight: 1.7, maxWidth: 240 }}>
              AI-powered urban heat solutions for homes, societies, and cities across India.
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              {["𝕏", "📸", "💼", "▶"].map((icon, i) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer", color: "rgba(255,255,255,0.50)", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(82,183,136,0.15)"; e.currentTarget.style.color = "#52B788"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.50)"; }}
                >{icon}</div>
              ))}
            </div>
          </div>
          {/* Link columns */}
          {cols.map(col => (
            <div key={col.title}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.30)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 16 }}>{col.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map(l => (
                  <Link key={l.label} href={l.href} style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={e => e.target.style.color = "#74C69D"}
                    onMouseLeave={e => e.target.style.color = "rgba(255,255,255,0.50)"}
                  >{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Made in India 🌿 · Open-Meteo data partner · HeatWise © 2026</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>Privacy · Terms</span>
        </div>
      </div>
    </footer>
  );
}

/* ── Layout wrapper ───────────────────────────────────────── */
export default function MarketingLayout({ children, title = "HeatWise — Turn Urban Heat Into Living Green Canopies", description = "AI-matched plants. Climate-aware layouts. Real cooling — measured in degrees." }) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content="https://heatwise-liart.vercel.app/icon-512.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ background: "linear-gradient(180deg,#040C18 0%,#071A10 40%,#040C18 100%)", minHeight: "100vh", color: "#fff", fontFamily: "'DM Sans','Inter',sans-serif" }}>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <MobileBanner />
      </div>
      <style global jsx>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #040C18; }
        ::selection { background: rgba(82,183,136,0.3); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #040C18; }
        ::-webkit-scrollbar-thumb { background: rgba(82,183,136,0.4); border-radius: 3px; }
      `}</style>
    </>
  );
}

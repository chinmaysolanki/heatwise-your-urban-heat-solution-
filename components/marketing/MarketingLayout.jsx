import { useState, useEffect } from "react";
import Link from "next/link";
import Head from "next/head";

const APP = "/app";

/* ── Nav ──────────────────────────────────────────────────────── */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { href: "/how-it-works", label: "How it Works" },
    { href: "/species",      label: "Species" },
    { href: "/science",      label: "Science" },
    { href: "/#pricing",     label: "Pricing" },
    { href: "/blog",         label: "Blog" },
  ];

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? "rgba(10,10,10,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(24px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.06)" : "none",
        transition: "all 0.4s cubic-bezier(0.4,0,0.2,1)",
        padding: "0 28px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 68 }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1B4332,#52B788)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🌿</div>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.5, fontFamily: "'Space Grotesk',sans-serif" }}>HeatWise</span>
          </Link>

          {/* Desktop links */}
          <div style={{ display: "flex", alignItems: "center", gap: 36 }} className="nav-desktop">
            {links.map(l => (
              <Link key={l.href} href={l.href}
                style={{ fontSize: 14, fontWeight: 500, color: "rgba(197,193,185,0.85)", textDecoration: "none", transition: "color 0.2s", letterSpacing: -0.1 }}
                onMouseEnter={e => e.target.style.color = "#fff"}
                onMouseLeave={e => e.target.style.color = "rgba(197,193,185,0.85)"}
              >{l.label}</Link>
            ))}
          </div>

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }} className="nav-desktop">
            <a href={`${APP}`} style={{ fontSize: 13, fontWeight: 600, color: "rgba(197,193,185,0.70)", textDecoration: "none" }}>Sign in</a>
            <a href={`${APP}?start=scan`} style={{
              background: "linear-gradient(135deg,#1B4332,#52B788)",
              color: "#fff", padding: "10px 22px", borderRadius: 100,
              fontWeight: 700, fontSize: 13, textDecoration: "none",
              display: "flex", alignItems: "center", gap: 6,
              boxShadow: "0 4px 20px rgba(82,183,136,0.30)",
              transition: "all 0.25s ease",
              letterSpacing: -0.1,
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.boxShadow = "0 6px 28px rgba(82,183,136,0.5)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(82,183,136,0.30)"; }}
            >Start Free Scan →</a>
          </div>

          {/* Mobile hamburger */}
          <button onClick={() => setOpen(!open)} className="nav-mobile-btn"
            style={{ background: "none", border: "none", color: "#fff", fontSize: 22, cursor: "pointer", padding: 4 }}>
            {open ? "✕" : "☰"}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="nav-mobile" style={{ background: "rgba(10,10,10,0.97)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "20px 28px 28px" }}>
            {links.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
                style={{ display: "block", padding: "12px 0", fontSize: 16, fontWeight: 600, color: "rgba(197,193,185,0.85)", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {l.label}
              </Link>
            ))}
            <a href={`${APP}?start=scan`} style={{ display: "block", marginTop: 20, background: "linear-gradient(135deg,#1B4332,#52B788)", color: "#fff", padding: "14px 24px", borderRadius: 100, fontWeight: 700, fontSize: 15, textDecoration: "none", textAlign: "center" }}>
              Start Free Scan →
            </a>
          </div>
        )}
      </nav>

      <style>{`
        @media(max-width:768px){
          .nav-desktop{ display:none !important; }
          .nav-mobile-btn{ display:block !important; }
        }
        @media(min-width:769px){
          .nav-mobile-btn{ display:none !important; }
        }
      `}</style>
    </>
  );
}

/* ── Mobile App Banner ────────────────────────────────────────── */
function MobileBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => { if (window.innerWidth < 768) setShow(true); }, []);
  if (!show) return null;
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 999,
      background: "linear-gradient(135deg,#1B4332,#2D6A4F)",
      padding: "14px 18px 22px",
      display: "flex", alignItems: "center", gap: 12,
      borderTop: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🌿</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>HeatWise</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>Free scan • 2,800+ households</div>
      </div>
      <a href={`${APP}?start=scan`} style={{ background: "#fff", color: "#1B4332", padding: "9px 18px", borderRadius: 100, fontWeight: 800, fontSize: 12, textDecoration: "none", whiteSpace: "nowrap" }}>
        Scan free →
      </a>
      <button onClick={() => setShow(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.40)", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>×</button>
    </div>
  );
}

/* ── Footer ───────────────────────────────────────────────────── */
function Footer() {
  const cols = [
    { title: "Product",  links: [{ label: "How it Works", href: "/how-it-works" }, { label: "Species Library", href: "/species" }, { label: "Pricing", href: "/#pricing" }, { label: "For Societies", href: "/contact" }] },
    { title: "Company",  links: [{ label: "Science", href: "/science" }, { label: "Blog", href: "/blog" }, { label: "Contact", href: "/contact" }, { label: "Press", href: "/contact" }] },
    { title: "Connect",  links: [{ label: "Installer Network", href: "/contact" }, { label: "Partner with Us", href: "/contact" }, { label: "Help Center", href: "/contact" }] },
  ];
  return (
    <footer style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.05)", padding: "64px 28px 40px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 48, marginBottom: 56 }} className="footer-grid">
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#1B4332,#52B788)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17 }}>🌿</div>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Space Grotesk',sans-serif" }}>HeatWise</span>
            </div>
            <p style={{ fontSize: 13, color: "rgba(197,193,185,0.45)", lineHeight: 1.75, maxWidth: 240 }}>
              AI-powered urban greening for homes, societies, and cities across India.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              {["𝕏", "📸", "💼", "▶"].map((icon, i) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, cursor: "pointer", color: "rgba(255,255,255,0.40)", transition: "all 0.2s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(82,183,136,0.12)"; e.currentTarget.style.color = "#52B788"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.40)"; }}
                >{icon}</div>
              ))}
            </div>
          </div>
          {/* Link columns */}
          {cols.map(col => (
            <div key={col.title}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 18 }}>{col.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {col.links.map(l => (
                  <Link key={l.label} href={l.href}
                    style={{ fontSize: 13, color: "rgba(197,193,185,0.45)", textDecoration: "none", transition: "color 0.2s" }}
                    onMouseEnter={e => e.target.style.color = "#74C69D"}
                    onMouseLeave={e => e.target.style.color = "rgba(197,193,185,0.45)"}
                  >{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <span style={{ fontSize: 12, color: "rgba(197,193,185,0.28)" }}>Built with 🌿 for cooler cities · HeatWise © 2026 · Made in India · Open-Meteo data partner</span>
          <span style={{ fontSize: 12, color: "rgba(197,193,185,0.28)" }}>Privacy · Terms</span>
        </div>
      </div>
      <style>{`
        @media(max-width:768px){
          .footer-grid{ grid-template-columns:1fr 1fr !important; gap:32px !important; }
          .footer-grid > div:first-child{ grid-column:1/-1; }
        }
      `}</style>
    </footer>
  );
}

/* ── Layout wrapper ───────────────────────────────────────────── */
export default function MarketingLayout({
  children,
  title = "HeatWise — Turn Urban Heat Into a Living Green Canopy",
  description = "AI-matched plants. Climate-aware layouts. Real cooling — measured in degrees. Transform any rooftop, balcony or terrace in minutes.",
}) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content="https://heatwise-liart.vercel.app/icon-512.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&family=Space+Grotesk:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>
      <div style={{ background: "#0d0d0d", minHeight: "100vh", color: "#c5c1b9", fontFamily: "'DM Sans','Inter',system-ui,sans-serif" }}>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <MobileBanner />
      </div>
      <style global jsx>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #0d0d0d; }
        ::selection { background: rgba(82,183,136,0.3); color: #fff; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #0d0d0d; }
        ::-webkit-scrollbar-thumb { background: rgba(82,183,136,0.35); border-radius: 4px; }
        input, textarea, button, select { font-family: inherit; }
        @keyframes heatRise {
          0%   { transform: translateY(0)   translateX(0)   scale(1);    opacity: 0.7; }
          25%  { transform: translateY(-8px) translateX(3px)  scale(1.05); opacity: 0.5; }
          50%  { transform: translateY(-16px) translateX(-2px) scale(1.1); opacity: 0.3; }
          75%  { transform: translateY(-24px) translateX(4px)  scale(1.05); opacity: 0.15; }
          100% { transform: translateY(-32px) translateX(0)   scale(1);    opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(82,183,136,0.3); }
          50% { box-shadow: 0 0 40px rgba(82,183,136,0.6); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
        @media (forced-colors: active) {
          * { forced-color-adjust: auto; }
        }
      `}</style>
    </>
  );
}

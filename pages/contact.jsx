import MarketingLayout from "@/components/marketing/MarketingLayout";
import { useState, useRef, useEffect } from "react";

function useInView(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function FadeUp({ children, delay = 0, style = {} }) {
  const [ref, visible] = useInView();
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s`, ...style }}>
      {children}
    </div>
  );
}

const options = [
  { icon: "🏘️", title: "For RWAs & Societies", desc: "Bulk greening plans for entire residential complexes. Volume pricing, shared dashboards, and installer coordination.", color: "#52B788" },
  { icon: "🏗️", title: "Join Installer Network", desc: "Are you a landscape or green-roofing company? Partner with HeatWise to receive verified leads in your city.", color: "#38BDF8" },
  { icon: "📰", title: "Press & Media", desc: "Coverage requests, founder interviews, data partnerships. We respond to all media inquiries within 24 hours.", color: "#A78BFA" },
  { icon: "💡", title: "General Enquiry", desc: "Anything else — pricing questions, API access, academic research collaborations, or just saying hi.", color: "#FB923C" },
];

function GlassInput({ label, type = "text", value, onChange, multiline, placeholder }) {
  const inputStyle = {
    width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12, padding: "14px 16px", color: "#fff", fontSize: 14,
    outline: "none", fontFamily: "'DM Sans',sans-serif", resize: "none",
    transition: "border-color 0.2s",
  };
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 0.5, marginBottom: 8 }}>{label}</label>
      {multiline
        ? <textarea value={value} onChange={onChange} rows={4} placeholder={placeholder} style={inputStyle} onFocus={e => e.target.style.borderColor = "#52B78888"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.10)"} />
        : <input type={type} value={value} onChange={onChange} placeholder={placeholder} style={inputStyle} onFocus={e => e.target.style.borderColor = "#52B78888"} onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.10)"} />
      }
    </div>
  );
}

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", org: "", type: "", message: "" });
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    setSending(true);
    await new Promise(r => setTimeout(r, 1200)); // simulate send
    setSending(false);
    setSent(true);
  };

  return (
    <MarketingLayout title="Contact HeatWise — Societies, Installers, Press, Enquiries" description="Reach out to HeatWise for society/RWA greening partnerships, installer network onboarding, press enquiries, or general questions.">
      <div style={{ paddingTop: 100 }}>

        {/* Hero */}
        <section style={{ padding: "80px 24px 60px", textAlign: "center" }}>
          <FadeUp>
            <div style={{ display: "inline-flex", gap: 8, background: "rgba(82,183,136,0.12)", border: "1px solid rgba(82,183,136,0.25)", borderRadius: 100, padding: "6px 16px", marginBottom: 24 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#52B788", letterSpacing: 2, fontFamily: "'JetBrains Mono',monospace" }}>GET IN TOUCH</span>
            </div>
          </FadeUp>
          <FadeUp delay={0.1}>
            <h1 style={{ fontSize: "clamp(32px,5vw,56px)", fontWeight: 900, color: "#fff", letterSpacing: -2, lineHeight: 1.1, marginBottom: 16, fontFamily: "'Space Grotesk',sans-serif" }}>
              Let's make your city<br /><span style={{ background: "linear-gradient(135deg,#52B788,#38BDF8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>measurably cooler</span>
            </h1>
          </FadeUp>
          <FadeUp delay={0.2}>
            <p style={{ fontSize: 17, color: "rgba(255,255,255,0.50)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>
              Whether you run a society, an installation company, or a newsroom — we want to hear from you.
            </p>
          </FadeUp>
        </section>

        {/* Option cards */}
        <section style={{ padding: "0 24px 60px", maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
            {options.map((o, i) => (
              <FadeUp key={i} delay={i * 0.08}>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: "28px 24px" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: `${o.color}18`, border: `1px solid ${o.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{o.icon}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 8 }}>{o.title}</h3>
                  <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>{o.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </section>

        {/* Contact form */}
        <section style={{ padding: "0 24px 100px", maxWidth: 640, margin: "0 auto" }}>
          <FadeUp>
            <div style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 24, padding: "40px 36px" }}>
              {sent ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <div style={{ fontSize: 52, marginBottom: 20 }}>🌿</div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 10 }}>Message received!</h2>
                  <p style={{ fontSize: 15, color: "rgba(255,255,255,0.50)", lineHeight: 1.7 }}>We'll get back to you within 1 business day. In the meantime, try a free scan below.</p>
                  <a href="/app?start=scan" style={{ display: "inline-block", marginTop: 24, background: "linear-gradient(135deg,#1B4332,#52B788)", color: "#fff", padding: "12px 24px", borderRadius: 12, fontWeight: 800, fontSize: 14, textDecoration: "none" }}>📷 Open App</a>
                </div>
              ) : (
                <form onSubmit={handleSubmit}>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 28 }}>Send us a message</h2>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <GlassInput label="Your Name *" value={form.name} onChange={set("name")} placeholder="Priya Mehta" />
                    <GlassInput label="Email *" type="email" value={form.email} onChange={set("email")} placeholder="priya@yourorg.com" />
                  </div>
                  <GlassInput label="Organisation" value={form.org} onChange={set("org")} placeholder="Sunrise Heights RWA" />

                  {/* Type select */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.45)", letterSpacing: 0.5, marginBottom: 8 }}>I'm reaching out about</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {["RWA / Society", "Installer Partnership", "Press", "General"].map(t => (
                        <button key={t} type="button" onClick={() => setForm(f => ({ ...f, type: t }))}
                          style={{ background: form.type === t ? "linear-gradient(135deg,#1B4332,#52B788)" : "rgba(255,255,255,0.05)", border: form.type === t ? "1px solid #52B78855" : "1px solid rgba(255,255,255,0.10)", borderRadius: 100, padding: "7px 16px", color: form.type === t ? "#fff" : "rgba(255,255,255,0.50)", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <GlassInput label="Message *" value={form.message} onChange={set("message")} multiline placeholder="Tell us about your project, space size, or question..." />

                  <button type="submit" disabled={sending || !form.name || !form.email || !form.message}
                    style={{
                      width: "100%", padding: "16px", borderRadius: 14, border: "none",
                      background: sending ? "rgba(82,183,136,0.3)" : "linear-gradient(135deg,#1B4332,#52B788)",
                      color: "#fff", fontSize: 15, fontWeight: 800, cursor: sending ? "wait" : "pointer",
                      boxShadow: "0 8px 24px rgba(82,183,136,0.3)", transition: "all 0.2s",
                      opacity: (!form.name || !form.email || !form.message) ? 0.5 : 1,
                    }}>
                    {sending ? "Sending..." : "Send message →"}
                  </button>

                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", textAlign: "center", marginTop: 16 }}>We respond within 1 business day. No spam, ever.</p>
                </form>
              )}
            </div>
          </FadeUp>
        </section>

      </div>
    </MarketingLayout>
  );
}

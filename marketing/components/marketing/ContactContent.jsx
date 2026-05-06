import { useState } from "react";
import { motion } from "framer-motion";
import MarketingLayout from "./MarketingLayout";
import { CONTACT_EMAIL, INSTALLER_EMAIL, PRESS_EMAIL } from "../../lib/config";

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
};

function FormField({ label, type = "text", placeholder, required, multiline, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const base = {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 12,
    border: `1.5px solid ${focused ? C.GREEN : "rgba(26,56,40,0.15)"}`,
    background: "#fff",
    fontSize: 15,
    color: C.FOREST,
    outline: "none",
    fontFamily: "'DM Sans', sans-serif",
    transition: "border-color 0.2s",
    boxSizing: "border-box",
  };
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.FOREST, marginBottom: 6 }}>
        {label}{required && <span style={{ color: C.HEAT_RED, marginLeft: 2 }}>*</span>}
      </label>
      {multiline ? (
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={5}
          style={{ ...base, resize: "vertical", minHeight: 120 }}
        />
      ) : (
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={base}
        />
      )}
    </div>
  );
}

const CONTACT_OPTIONS = [
  { icon: "💬", title: "General Enquiry", desc: "Questions about the product, pricing or partnerships", time: "Reply within 24h" },
  { icon: "🔨", title: "Become an Installer", desc: "Join our network of verified green-thumb professionals", time: "Reply within 48h" },
  { icon: "🏢", title: "Enterprise / Society", desc: "Large-scale projects, housing societies, commercial spaces", time: "Reply within 4h" },
  { icon: "📰", title: "Press & Media", desc: "Interview requests, data partnerships, research collaboration", time: "Reply within 12h" },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", city: "" });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    const subject = encodeURIComponent(form.subject || "HeatWise Enquiry");
    const body = encodeURIComponent(
      `Name: ${form.name}\nEmail: ${form.email}\nCity: ${form.city}\n\n${form.message}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <MarketingLayout title="Contact HeatWise" description="Get in touch with the HeatWise team — general enquiries, installer partnerships, enterprise projects and press.">
      <style>{`
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse-glow { 0%, 100% { box-shadow: 0 0 16px 2px rgba(64,176,112,0.3); } 50% { box-shadow: 0 0 32px 8px rgba(64,176,112,0.6); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Hero */}
      <section style={{ padding: "80px 24px 60px", background: C.CREAM, textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -200, left: "50%", transform: "translateX(-50%)", width: 700, height: 500, background: `radial-gradient(ellipse, ${C.MINT} 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ maxWidth: 640, margin: "0 auto", position: "relative" }}>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: C.GREEN, marginBottom: 16 }}>
            We'd love to hear from you
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: "clamp(32px,5vw,56px)", fontWeight: 800, color: C.FOREST, lineHeight: 1.1, marginBottom: 20 }}>
            Get in{" "}
            <span style={{ background: `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>touch</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            style={{ fontSize: 17, lineHeight: 1.7, color: C.FOREST, opacity: 0.7 }}>
            Whether you're a homeowner, housing society, installer, journalist or researcher — we have someone for you.
          </motion.p>
        </div>
      </section>

      {/* Contact options */}
      <section style={{ padding: "0 24px 60px", background: C.CREAM }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }} className="contact-opts">
            <style>{`@media (max-width: 900px) { .contact-opts { grid-template-columns: repeat(2,1fr) !important; } } @media (max-width: 500px) { .contact-opts { grid-template-columns: 1fr !important; } }`}</style>
            {CONTACT_OPTIONS.map((opt, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.4 }}
                whileHover={{ y: -4, boxShadow: "0 8px 28px rgba(64,176,112,0.12)" }}
                style={{ background: "#fff", border: `1px solid rgba(26,56,40,0.08)`, borderRadius: 18, padding: "24px 20px", textAlign: "center", cursor: "pointer", transition: "box-shadow 0.3s", boxShadow: "0 2px 10px rgba(26,56,40,0.04)" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>{opt.icon}</div>
                <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 15, color: C.FOREST, marginBottom: 8 }}>{opt.title}</h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: C.FOREST, opacity: 0.6, marginBottom: 12 }}>{opt.desc}</p>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: C.GREEN, background: C.MINT, borderRadius: 999, padding: "3px 10px" }}>{opt.time}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Main content: form + info */}
      <section style={{ padding: "0 24px 100px", background: "#fff" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "start" }} className="contact-grid">
          <style>{`@media (max-width: 768px) { .contact-grid { grid-template-columns: 1fr !important; } }`}</style>

          {/* Form */}
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            style={{ background: C.CREAM, borderRadius: 24, padding: "40px 36px" }}>
            {submitted ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 56, marginBottom: 20, animation: "bob 3s ease-in-out infinite" }}>🌿</div>
                <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 24, fontWeight: 700, color: C.FOREST, marginBottom: 12 }}>Message sent!</h3>
                <p style={{ fontSize: 15, lineHeight: 1.7, color: C.FOREST, opacity: 0.7 }}>We've received your message and will get back to you shortly. Expect a reply within 24 hours.</p>
              </motion.div>
            ) : (
              <>
                <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 24, color: C.FOREST, marginBottom: 28 }}>Send a message</h2>
                <form onSubmit={handleSubmit}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                    <FormField label="Full Name" placeholder="Aanya Mehta" required value={form.name} onChange={update("name")} />
                    <FormField label="Email" type="email" placeholder="you@example.com" required value={form.email} onChange={update("email")} />
                  </div>
                  <FormField label="City" placeholder="Mumbai, Delhi, Bengaluru..." value={form.city} onChange={update("city")} />
                  <FormField label="Subject" placeholder="What's this about?" required value={form.subject} onChange={update("subject")} />
                  <FormField label="Message" multiline placeholder="Tell us more..." required value={form.message} onChange={update("message")} />
                  <button
                    type="submit"
                    disabled={submitting}
                    style={{ width: "100%", padding: "14px 0", borderRadius: 999, background: submitting ? "rgba(64,176,112,0.5)" : `linear-gradient(135deg, ${C.GREEN}, ${C.FOREST_MID})`, color: "#fff", fontWeight: 700, fontSize: 16, border: "none", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    {submitting ? (
                      <>
                        <span style={{ width: 18, height: 18, border: "2px solid rgba(255,255,255,0.3)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        Sending...
                      </>
                    ) : "Send Message →"}
                  </button>
                </form>
              </>
            )}
          </motion.div>

          {/* Info */}
          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 24, color: C.FOREST, marginBottom: 32 }}>Other ways to reach us</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {[
                { icon: "📧", label: "Email", val: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, sub: "General enquiries" },
                { icon: "🔨", label: "Installers", val: INSTALLER_EMAIL, href: `mailto:${INSTALLER_EMAIL}`, sub: "Join our network" },
                { icon: "📰", label: "Press", val: PRESS_EMAIL, href: `mailto:${PRESS_EMAIL}`, sub: "Media & research" },
                { icon: "📍", label: "Headquarters", val: "Bengaluru, Karnataka", href: null, sub: "India" },
              ].map((item) => (
                <div key={item.label} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.MINT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                  <div>
                    <p style={{ fontSize: 12, fontFamily: "'JetBrains Mono',monospace", color: C.GREEN, marginBottom: 2 }}>{item.label}</p>
                    {item.href ? (
                      <a href={item.href} style={{ fontWeight: 700, fontSize: 15, color: C.FOREST_MID, textDecoration: "none" }}>{item.val}</a>
                    ) : (
                      <p style={{ fontWeight: 700, fontSize: 15, color: C.FOREST }}>{item.val}</p>
                    )}
                    <p style={{ fontSize: 13, color: C.FOREST, opacity: 0.5 }}>{item.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 40, padding: "20px 24px", background: `${C.GREEN}10`, border: `1px solid ${C.GREEN}30`, borderRadius: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: C.FOREST_MID, marginBottom: 4 }}>🕐 Response times</p>
              <p style={{ fontSize: 13, color: C.FOREST, opacity: 0.65, lineHeight: 1.6 }}>We're a small team in IST (UTC+5:30). We typically respond Mon–Sat, 9am–7pm. Enterprise enquiries get priority routing — expect a call back within 4 hours.</p>
            </div>
          </motion.div>
        </div>
      </section>
    </MarketingLayout>
  );
}

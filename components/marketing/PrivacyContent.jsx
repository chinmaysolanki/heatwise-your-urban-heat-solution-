import MarketingLayout from "@/components/marketing/MarketingLayout";
import Link from "next/link";

const C = { FOREST: "#1a3828", FOREST_MID: "#2a5c3e", GREEN: "#40b070", MINT: "#e0f5e8", CREAM: "#fafaf6" };

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 40 }}>
    <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: C.FOREST, marginBottom: 12 }}>{title}</h2>
    <div style={{ fontSize: 15, lineHeight: 1.85, color: C.FOREST, opacity: 0.75 }}>{children}</div>
  </div>
);

export default function PrivacyContent() {
  return (
    <MarketingLayout title="Privacy Policy — HeatWise" description="How HeatWise collects, uses and protects your personal data.">
      <div style={{ background: C.CREAM, padding: "80px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ marginBottom: 56 }}>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.GREEN, marginBottom: 12 }}>Legal</p>
            <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 700, color: C.FOREST, marginBottom: 16 }}>Privacy Policy</h1>
            <p style={{ fontSize: 14, color: C.FOREST, opacity: 0.45, fontFamily: "'JetBrains Mono',monospace" }}>Last updated: May 2026 · Effective immediately</p>
          </div>

          <Section title="1. Who we are">
            <p>HeatWise is an AI-powered urban cooling platform built and operated by Chinmay Solanki, based in Bengaluru, India. We help users plan green cover for rooftops, balconies and terraces using live climate data and AI species recommendations.</p>
            <p style={{ marginTop: 12 }}>Contact: <a href="mailto:hello@heatwise.in" style={{ color: C.GREEN }}>hello@heatwise.in</a></p>
          </Section>

          <Section title="2. What data we collect">
            <p><strong>Location data:</strong> GPS coordinates when you use the AR scan or climate features. We use this only to fetch live weather data and generate plant recommendations. We do not store raw GPS coordinates on our servers beyond the duration of your scan session.</p>
            <p style={{ marginTop: 10 }}><strong>Camera access:</strong> The AR scan feature requires camera access. Images are processed locally on your device and are not uploaded to our servers.</p>
            <p style={{ marginTop: 10 }}><strong>Account data:</strong> If you create an account, we collect your phone number (for OTP login), name, and city.</p>
            <p style={{ marginTop: 10 }}><strong>Usage data:</strong> We collect anonymised analytics about how the app is used (screens visited, features used, crash reports) to improve the product.</p>
            <p style={{ marginTop: 10 }}><strong>Email:</strong> If you subscribe to our newsletter or waitlist, we store your email address.</p>
          </Section>

          <Section title="3. How we use your data">
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}>To provide climate-accurate plant recommendations for your location</li>
              <li style={{ marginBottom: 8 }}>To generate and display your personalised cooling score and garden layout</li>
              <li style={{ marginBottom: 8 }}>To connect you with verified installers in your city</li>
              <li style={{ marginBottom: 8 }}>To send product updates and cooling tips (newsletter, only if subscribed)</li>
              <li style={{ marginBottom: 8 }}>To improve our AI models and recommendation engine using anonymised data</li>
            </ul>
            <p style={{ marginTop: 12 }}>We do not sell your personal data to third parties. We do not use your data for advertising.</p>
          </Section>

          <Section title="4. Third-party services">
            <p>We use the following third-party services to operate HeatWise:</p>
            <ul style={{ paddingLeft: 20, marginTop: 10 }}>
              <li style={{ marginBottom: 8 }}><strong>Open-Meteo</strong> — weather and climate data (no personal data shared)</li>
              <li style={{ marginBottom: 8 }}><strong>Vercel</strong> — hosting and deployment (processes requests, standard logging)</li>
              <li style={{ marginBottom: 8 }}><strong>OpenAI</strong> — AI garden visualization (anonymised prompts, no personal data)</li>
            </ul>
          </Section>

          <Section title="5. Data retention">
            <p>We retain your account data for as long as your account is active. You can request deletion at any time by emailing <a href="mailto:hello@heatwise.in" style={{ color: C.GREEN }}>hello@heatwise.in</a>. We will delete your data within 30 days of a valid request.</p>
          </Section>

          <Section title="6. Your rights">
            <p>You have the right to access, correct, or delete your personal data. To exercise these rights, email us at <a href="mailto:hello@heatwise.in" style={{ color: C.GREEN }}>hello@heatwise.in</a>.</p>
          </Section>

          <Section title="7. Cookies">
            <p>Our website uses minimal cookies — only those required for the site to function (session management). We do not use tracking or advertising cookies.</p>
          </Section>

          <Section title="8. Children">
            <p>HeatWise is not directed at children under 13. We do not knowingly collect data from children.</p>
          </Section>

          <Section title="9. Changes to this policy">
            <p>We may update this policy from time to time. Significant changes will be notified via email or in-app notification.</p>
          </Section>

          <Section title="10. Contact">
            <div style={{ padding: "20px 24px", background: "#fff", border: "1px solid rgba(26,56,40,0.1)", borderRadius: 16 }}>
              <p style={{ fontWeight: 700, color: C.FOREST, marginBottom: 4 }}>HeatWise Privacy</p>
              <p><a href="mailto:hello@heatwise.in" style={{ color: C.GREEN }}>hello@heatwise.in</a></p>
              <p style={{ marginTop: 4, opacity: 0.6, fontSize: 13 }}>Bengaluru, India</p>
            </div>
          </Section>
        </div>
      </div>
    </MarketingLayout>
  );
}

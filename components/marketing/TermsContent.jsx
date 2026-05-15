import MarketingLayout from "@/components/marketing/MarketingLayout";

const C = { FOREST: "#1a3828", FOREST_MID: "#2a5c3e", GREEN: "#40b070", MINT: "#e0f5e8", CREAM: "#fafaf6" };

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 40 }}>
    <h2 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 22, fontWeight: 700, color: C.FOREST, marginBottom: 12 }}>{title}</h2>
    <div style={{ fontSize: 15, lineHeight: 1.85, color: C.FOREST, opacity: 0.75 }}>{children}</div>
  </div>
);

export default function TermsContent() {
  return (
    <MarketingLayout title="Terms of Service — HeatWise" description="Terms and conditions for using the HeatWise platform.">
      <div style={{ background: C.CREAM, padding: "80px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ marginBottom: 56 }}>
            <p style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: C.GREEN, marginBottom: 12 }}>Legal</p>
            <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 700, color: C.FOREST, marginBottom: 16 }}>Terms of Service</h1>
            <p style={{ fontSize: 14, color: C.FOREST, opacity: 0.45, fontFamily: "'JetBrains Mono',monospace" }}>Last updated: May 2026 · Effective immediately</p>
          </div>

          <Section title="1. Agreement to terms">
            <p>By accessing or using HeatWise — including our website, Android app, and any related services — you agree to be bound by these Terms of Service. If you do not agree, please do not use our services.</p>
            <p style={{ marginTop: 10 }}>HeatWise is operated by Chinmay Solanki ("we", "us", "our") from Bengaluru, India.</p>
          </Section>

          <Section title="2. What HeatWise provides">
            <ul style={{ paddingLeft: 20 }}>
              <li style={{ marginBottom: 8 }}>An AI-powered space scanning tool to estimate your rooftop or terrace dimensions</li>
              <li style={{ marginBottom: 8 }}>Climate-based plant species recommendations for your location</li>
              <li style={{ marginBottom: 8 }}>Cooling score estimates based on scientific models and live weather data</li>
              <li style={{ marginBottom: 8 }}>A network of third-party green installers (we are a marketplace, not a service provider)</li>
              <li style={{ marginBottom: 8 }}>A plant species catalog for educational and planning purposes</li>
            </ul>
          </Section>

          <Section title="3. Accuracy of recommendations">
            <p>HeatWise cooling scores and plant recommendations are estimates based on available climate data and scientific models. Actual results may vary. We do not guarantee specific cooling outcomes.</p>
          </Section>

          <Section title="4. Installer network">
            <p>Installers listed on HeatWise are independent third-party service providers. HeatWise is not responsible for the quality, timeliness or outcome of their work. Any disputes with an installer should first be resolved directly with the installer.</p>
          </Section>

          <Section title="5. User accounts">
            <p>You are responsible for maintaining the security of your account and all activity that occurs under it. We reserve the right to terminate accounts that violate these terms.</p>
          </Section>

          <Section title="6. Acceptable use">
            <p>You agree not to use HeatWise for any unlawful purpose, attempt to reverse-engineer our AI models, use automated tools to access our services without permission, or misrepresent your identity.</p>
          </Section>

          <Section title="7. Payments and refunds">
            <p><strong>Starter plan:</strong> Free forever.</p>
            <p style={{ marginTop: 10 }}><strong>Green and Pro plans:</strong> Billed monthly in INR. We offer a 30-day money-back guarantee — email <a href="mailto:hello@heatwise.in" style={{ color: C.GREEN }}>hello@heatwise.in</a> within the first 30 days for a full refund.</p>
          </Section>

          <Section title="8. Intellectual property">
            <p>All content, design, code, species data, AI models, and trademarks on HeatWise are owned by or licensed to HeatWise. Your scan data and garden plans belong to you.</p>
          </Section>

          <Section title="9. Limitation of liability">
            <p>To the fullest extent permitted by applicable law, HeatWise is not liable for any indirect, incidental, or consequential damages. Our total liability for any claim shall not exceed the amount you paid us in the 3 months preceding the claim.</p>
          </Section>

          <Section title="10. Governing law">
            <p>These terms are governed by the laws of India. Any disputes shall be subject to the jurisdiction of courts in Bengaluru, Karnataka, India.</p>
          </Section>

          <Section title="11. Contact">
            <div style={{ padding: "20px 24px", background: "#fff", border: "1px solid rgba(26,56,40,0.1)", borderRadius: 16 }}>
              <p style={{ fontWeight: 700, color: C.FOREST, marginBottom: 4 }}>HeatWise Legal</p>
              <p><a href="mailto:hello@heatwise.in" style={{ color: C.GREEN }}>hello@heatwise.in</a></p>
              <p style={{ marginTop: 4, opacity: 0.6, fontSize: 13 }}>Bengaluru, Karnataka, India</p>
            </div>
          </Section>
        </div>
      </div>
    </MarketingLayout>
  );
}

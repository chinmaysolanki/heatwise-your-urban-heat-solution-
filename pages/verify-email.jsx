import { useRouter } from "next/router";
import Head from "next/head";
import EmailVerification from "@/components/EmailVerification";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { email, redirect } = router.query;

  function handleVerified({ email: verifiedEmail }) {
    const dest = redirect ? decodeURIComponent(redirect) : "/dashboard";
    router.push(dest);
  }

  return (
    <>
      <Head>
        <title>Verify Email — HeatWise</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "linear-gradient(160deg, #0f1a12 0%, #1a3828 100%)",
        padding: "24px 16px",
      }}>
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌿</div>
          <p style={{ color: "rgba(224,245,232,0.5)", fontSize: 13, margin: 0, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.08em" }}>
            HEATWISE · EMAIL VERIFICATION
          </p>
        </div>
        <EmailVerification
          initialEmail={email ?? ""}
          onVerified={handleVerified}
          onSkip={() => router.push(redirect ? decodeURIComponent(redirect) : "/")}
        />
      </div>
    </>
  );
}

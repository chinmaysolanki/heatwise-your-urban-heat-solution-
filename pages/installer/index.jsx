import dynamic from "next/dynamic";
import Head from "next/head";

function Loading() {
  return (
    <div style={{ height: "100vh", background: "#0a1628", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: "50%", border: "3px solid rgba(56,189,248,0.15)", borderTop: "3px solid #38BDF8", animation: "spin 0.9s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, letterSpacing: "3px", color: "rgba(56,189,248,0.5)" }}>HEATWISE INSTALLER</span>
    </div>
  );
}

const InstallerPortal = dynamic(
  () => import("@/components/installer/InstallerPortal"),
  { ssr: false, loading: () => <Loading /> }
);

export default function InstallerPage() {
  return (
    <>
      <Head>
        <title>HeatWise — Installer Portal</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="theme-color" content="#0a1628" />
      </Head>
      <InstallerPortal />
    </>
  );
}

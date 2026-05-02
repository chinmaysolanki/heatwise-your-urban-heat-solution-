import dynamic from "next/dynamic";
import { useEffect } from "react";

function AppLoader() {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "#04091A",
      gap: 20,
    }}>
      <div style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        border: "3px solid rgba(56,189,248,0.15)",
        borderTop: "3px solid #38BDF8",
        animation: "spin 0.9s linear infinite",
      }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        letterSpacing: "3px",
        color: "rgba(56,189,248,0.5)",
      }}>
        HEATWISE
      </div>
    </div>
  );
}

const HeatWiseApp = dynamic(() => import("@/components/HeatWiseApp"), {
  ssr: false,
  loading: () => <AppLoader />,
});

export default function Home() {
  // Read ?start= deep-link param from the marketing website
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const start = params.get("start");
      if (start) {
        // Store it — HeatWiseApp reads this on mount to navigate directly
        sessionStorage.setItem("hw_deeplink", start);
        // Clean the URL without reload
        const clean = window.location.pathname;
        window.history.replaceState({}, "", clean);
      }
    } catch {}
  }, []);

  return <HeatWiseApp />;
}

import React from "react";
import type { LiveARSessionState } from "../types";

type Props = {
  state: LiveARSessionState;
};

export function LiveARViewport({ state }: Props) {
  const result = state.resultPreview;
  const hasResult = !!result?.polygon;

  return (
    <div style={{
      flex: 1,
      minHeight: 260,
      background: "radial-gradient(circle at 15% 20%, rgba(82,183,136,0.18), transparent 55%), rgba(9,22,14,0.95)",
      borderRadius: 18,
      border: `1px solid ${hasResult ? "rgba(82,183,136,0.4)" : "rgba(82,183,136,0.14)"}`,
      padding: "14px 16px",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      transition: "border-color .3s ease",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{
          fontSize: 10, letterSpacing: "1.5px", fontWeight: 700,
          color: "rgba(82,183,136,0.8)", textTransform: "uppercase",
        }}>
          Live AR · {state.points.length} pts
        </div>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: state.active ? "#52B788" : "rgba(82,183,136,0.25)",
          boxShadow: state.active ? "0 0 8px rgba(82,183,136,0.7)" : "none",
          transition: "all .3s",
        }} />
      </div>

      {/* Measurement data */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {result?.edges?.length ? (
          <div>
            {result.edges.slice(0, 4).map((e, idx) => (
              <div key={e.id} style={{
                display: "flex", justifyContent: "space-between",
                fontSize: 12, color: "rgba(216,243,220,0.7)", padding: "3px 0",
                borderBottom: "1px solid rgba(82,183,136,0.08)",
              }}>
                <span style={{ color: "rgba(82,183,136,0.7)" }}>Edge {idx + 1}</span>
                <span style={{ fontWeight: 600, color: "#D8F3DC" }}>{e.lengthM.toFixed(2)} m</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "rgba(216,243,220,0.35)", textAlign: "center", paddingTop: 20 }}>
            {state.active ? "Place points on the rooftop" : "Start session to measure"}
          </div>
        )}

        {result?.polygon && (
          <div style={{
            marginTop: 6, padding: "10px 12px", borderRadius: 10,
            background: "rgba(82,183,136,0.08)", border: "1px solid rgba(82,183,136,0.18)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#52B788" }}>
              {result.polygon.areaSqM.toFixed(1)} m²
            </div>
            <div style={{ fontSize: 11, color: "rgba(216,243,220,0.5)", marginTop: 2 }}>
              Perimeter: {result.polygon.perimeterM.toFixed(1)} m
            </div>
            {result.polygon.selfIntersecting && (
              <div style={{ fontSize: 11, color: "#E76F51", marginTop: 4 }}>
                ⚠ Polygon self-intersects — adjust points
              </div>
            )}
          </div>
        )}

        {result?.widthM != null && result?.lengthM != null && (
          <div style={{ fontSize: 12, color: "rgba(216,243,220,0.6)" }}>
            {result.widthM.toFixed(1)} × {result.lengthM.toFixed(1)} m
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 10, color: "rgba(216,243,220,0.35)", marginTop: 10,
        paddingTop: 8, borderTop: "1px solid rgba(82,183,136,0.08)",
      }}>
        <span>Tracking: {state.trackingQuality.toUpperCase()}</span>
        {result && (
          <span style={{ color: result.confidence === "high" ? "#52B788" : result.confidence === "medium" ? "#F9C74F" : "#E76F51" }}>
            {result.confidence.toUpperCase()} {Math.round(result.confidenceScore * 100)}%
          </span>
        )}
      </div>
    </div>
  );
}



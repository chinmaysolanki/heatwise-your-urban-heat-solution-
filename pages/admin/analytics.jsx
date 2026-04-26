import { useEffect, useState } from "react";

const Card = ({ title, value, sub }) => (
  <div style={{border:"1px solid rgba(0,255,136,.18)",background:"rgba(0,12,6,.92)",padding:14}}>
    <div style={{fontFamily:"JetBrains Mono, monospace",fontSize:10,letterSpacing:"2px",color:"rgba(0,255,136,.65)",marginBottom:8}}>
      {title}
    </div>
    <div style={{fontSize:28,fontWeight:800,color:"#E0F5E8",lineHeight:1.1}}>
      {value}
    </div>
    {sub && (
      <div style={{marginTop:8,fontFamily:"JetBrains Mono, monospace",fontSize:10,letterSpacing:"1px",color:"rgba(184,220,192,.55)"}}>
        {sub}
      </div>
    )}
  </div>
);

const fmtPct = (v) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : "—");
const fmtNum = (v) => (typeof v === "number" ? v.toFixed(2) : "—");

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const res = await fetch("/api/admin/analytics");
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || `Request failed (${res.status})`);
        }
        const j = await res.json();
        setData(j);
      } catch (e) {
        setErr(e?.message || "Failed to load");
      }
    })();
  }, []);

  return (
    <div style={{minHeight:"100vh",background:"#000814",color:"#B8DCC0",padding:"24px 18px"}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <div style={{marginBottom:18}}>
          <div style={{fontFamily:"JetBrains Mono, monospace",fontSize:10,letterSpacing:"3px",color:"rgba(0,255,136,.6)"}}>
            // INTERNAL · ADMIN ONLY
          </div>
          <div style={{fontSize:26,fontWeight:900,color:"#E0F5E8",letterSpacing:"1px"}}>
            HeatWise Analytics
          </div>
        </div>

        {err && (
          <div style={{border:"1px solid rgba(255,68,0,.35)",background:"rgba(255,68,0,.08)",padding:14,marginBottom:16}}>
            {err}
          </div>
        )}

        {!data ? (
          <div style={{fontFamily:"JetBrains Mono, monospace",fontSize:12,color:"rgba(184,220,192,.55)"}}>
            Loading…
          </div>
        ) : (
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3, minmax(0, 1fr))",gap:12}}>
              <Card
                title="RECOMMENDATION RUNS"
                value={data.recommendationRuns?.total ?? 0}
              />
              <Card
                title="AVG SELECTED RANK"
                value={fmtNum(data.topCandidateRankSelected?.averageRank)}
                sub={`${data.topCandidateRankSelected?.samples ?? 0} samples`}
              />
              <Card
                title="INSTALL CONVERSION"
                value={fmtPct(data.installationRequestConversionRate?.rate)}
                sub={`${data.installationRequestConversionRate?.installationRequests ?? 0} requests / ${data.installationRequestConversionRate?.sessionsWithRecs ?? 0} sessions`}
              />
              <Card
                title="SAVE RATE"
                value={fmtPct(data.saveRate?.rate)}
                sub={`${data.saveRate?.savedEvents ?? 0} saves / ${data.saveRate?.viewEvents ?? 0} views`}
              />
              <Card
                title="VISUALIZATION RATE"
                value={fmtPct(data.visualizationGenerationRate?.rate)}
                sub={`${data.visualizationGenerationRate?.sessionsWithVisualization ?? 0} sessions / ${data.visualizationGenerationRate?.sessionsWithRecs ?? 0} sessions`}
              />
              <Card
                title="REGEN RATE"
                value={fmtPct(data.regenerationRate?.rate)}
                sub={`${data.regenerationRate?.regenerations ?? 0} regen / ${data.regenerationRate?.totalVisualizations ?? 0} visuals`}
              />
              <Card
                title="AVG HEAT DROP (°C)"
                value={fmtNum(data.heatReduction?.averageEstimatedDropC)}
                sub={`${data.heatReduction?.samples ?? 0} samples`}
              />
              <Card
                title="AVG COST RANGE"
                value={
                  (typeof data.costEstimate?.averageTotalMin === "number" && typeof data.costEstimate?.averageTotalMax === "number")
                    ? `${Math.round(data.costEstimate.averageTotalMin)}–${Math.round(data.costEstimate.averageTotalMax)}`
                    : "—"
                }
                sub={`${data.costEstimate?.samples ?? 0} samples`}
              />
              <Card
                title="DEBUG ACTIONS"
                value={Object.keys(data.debug?.feedbackActions || {}).length}
                sub="Unique feedback action types"
              />
            </div>

            <div style={{marginTop:18,border:"1px solid rgba(0,255,136,.12)",padding:14,background:"rgba(0,12,6,.75)"}}>
              <div style={{fontFamily:"JetBrains Mono, monospace",fontSize:10,letterSpacing:"2px",color:"rgba(0,255,136,.65)",marginBottom:8}}>
                NOTES
              </div>
              <div style={{fontSize:12,color:"rgba(184,220,192,.6)",lineHeight:1.7}}>
                - This dashboard is internal/admin-only (controlled by <code>HEATWISE_ADMIN_EMAILS</code>).<br/>
                - Save rate depends on the UI emitting <code>save</code>/<code>saved</code> events. If not emitted, it will show “—”.<br/>
                - Heat/cost averages are computed from the <code>selectedCandidate</code> on photo sessions when available.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


import React from "react";

/* ─────────────────────────────────────────────────────────────
   HEATWISE — Light Dashboard
   Colour palette: white/light-gray base · forest green hero
   pastel action cards · white project cards · green accents
───────────────────────────────────────────────────────────── */

const L = {
  /* backgrounds */
  pageBg:    "#F2F3F7",
  white:     "#FFFFFF",
  heroBg:    "linear-gradient(160deg,#1B4332 0%,#2D6A4F 60%,#40916C 100%)",

  /* greens */
  green:     "#2D6A4F",
  greenDark: "#1B4332",
  greenMid:  "#40916C",
  greenLight:"#74C69D",
  greenPale: "#D8F3DC",
  greenText: "#2D6A4F",

  /* action card backgrounds */
  cardGreen:  "#E8F5EC",
  cardBlue:   "#E3F0FD",
  cardAmber:  "#FFF4E1",
  cardPurple: "#F3E8FB",

  /* action card icon colours */
  iconGreen:  "#2D6A4F",
  iconBlue:   "#1565C0",
  iconAmber:  "#D84315",
  iconPurple: "#6A1B9A",

  /* text */
  textDark:  "#111827",
  textMid:   "#374151",
  textGray:  "#6B7280",
  textLight: "#9CA3AF",

  /* status */
  orange:    "#E65100",
  orangeBg:  "#FFF0E6",
  badge:     "#2D6A4F",

  /* misc */
  border:    "rgba(0,0,0,0.07)",
  shadow:    "0 2px 12px rgba(0,0,0,0.07)",
  shadowMd:  "0 4px 20px rgba(0,0,0,0.10)",
};

/* ── tiny SVG icons ─────────────────────────────────────────── */
const PlusIcon = ({ c }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/>
    <line x1="8" y1="12" x2="16" y2="12"/>
  </svg>
);
const CameraIcon = ({ c }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const ChartIcon = ({ c }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <path d="M3 9h18M9 21V9"/>
  </svg>
);
const LeafIcon = ({ c }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  </svg>
);
const BellIcon = ({ c = L.textDark }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const UserIcon = ({ c = L.textDark }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);
const ThermIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
  </svg>
);
const SunIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);
const DropIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)"
    stroke="none">
    <path d="M12 2C6 8 4 13 4 16a8 8 0 0016 0c0-3-2-8-8-14z"/>
  </svg>
);
const WindIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
  </svg>
);
const ChevronRight = ({ c = L.textGray }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);
const MapPinIcon = ({ c }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

/* ── QUICK ACTION CARD ──────────────────────────────────────── */
const ActionCard = ({ bg, iconColor, Icon, label, onClick }) => (
  <button onClick={onClick} style={{
    background: "rgba(255,255,255,0.38)",
    backdropFilter: "blur(22px)",
    WebkitBackdropFilter: "blur(22px)",
    border: "1.5px solid rgba(255,255,255,0.65)",
    borderRadius: 18,
    padding: "16px 8px 12px",
    display: "flex", flexDirection: "column",
    alignItems: "center", gap: 10,
    cursor: "pointer",
    flex: "1 1 0",
    minWidth: 0,
    transition: "transform .15s, box-shadow .15s",
    boxShadow: "0 6px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.55)",
  }}
    onMouseDown={e => e.currentTarget.style.transform = "scale(0.96)"}
    onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
  >
    <div style={{
      width: 52, height: 52,
      background: "rgba(255,255,255,0.22)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      borderRadius: 14,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "1px solid rgba(255,255,255,0.30)",
    }}>
      <Icon c={iconColor} />
    </div>
    <span style={{
      fontSize: 12, fontWeight: 700, color: "#1B4332",
      textAlign: "center", lineHeight: 1.2,
    }}>{label}</span>
  </button>
);

/* ── STAT PILL ──────────────────────────────────────────────── */
const StatPill = ({ icon: Icon, label }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 5,
    background: "rgba(255,255,255,0.18)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.28)",
    borderRadius: 20, padding: "6px 12px",
  }}>
    <Icon />
    <span style={{ fontSize: 12, color: "#fff", fontWeight: 500 }}>{label}</span>
  </div>
);

/* ── PROJECT CARD ───────────────────────────────────────────── */
const TYPE_TINTS = {
  Rooftop:    "rgba(27,67,50,0.45)",
  Balcony:    "rgba(21,94,117,0.40)",
  Terrace:    "rgba(120,53,15,0.38)",
  Backyard:   "rgba(6,78,59,0.42)",
  Courtyard:  "rgba(67,20,7,0.38)",
  Indoor:     "rgba(49,46,129,0.38)",
};

const ProjectCard = ({ title, type, area, image, status, heatReduction, lastUpdated, aiStatus, aiColor, onClick }) => {
  const tint = TYPE_TINTS[type] || TYPE_TINTS.Rooftop;
  const src  = image || "/garden-bg.webp";
  return (
  <div onClick={onClick} style={{
    background: "rgba(255,255,255,0.38)",
    backdropFilter: "blur(22px)",
    WebkitBackdropFilter: "blur(22px)",
    borderRadius: 20,
    overflow: "hidden",
    boxShadow: "0 6px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.60)",
    cursor: onClick ? "pointer" : "default",
  }}>
    {/* Compact horizontal layout: thumbnail left, info right */}
    <div style={{ display: "flex", alignItems: "stretch", height: 80 }}>
      {/* Thumbnail */}
      <div style={{ position: "relative", width: 90, flexShrink: 0, overflow: "hidden" }}>
        <img
          src={src} alt={title}
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 55%" }}
          onError={e => { e.target.src = "/garden-bg.webp"; }}
        />
        <div style={{ position: "absolute", inset: 0, background: tint }} />
      </div>
      {/* Info */}
      <div style={{ flex: 1, padding: "10px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#1B4332", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
            <div style={{ fontSize: 11, color: "#40916C", marginTop: 1 }}>{type} · {area}</div>
          </div>
          <div style={{
            background: "rgba(45,106,79,0.12)", border: "1px solid rgba(45,106,79,0.25)",
            borderRadius: 20, padding: "2px 9px", flexShrink: 0, marginLeft: 8,
          }}>
            <span style={{ fontSize: 10, color: "#2D6A4F", fontWeight: 700 }}>{status}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 10, color: "#6B7280" }}>{lastUpdated}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: aiColor }}>{aiStatus}</span>
        </div>
      </div>
    </div>
  </div>
  );
};

/* ── IMPACT MINI CARD ───────────────────────────────────────── */
const ImpactCard = ({ icon, label, value, unit, bg, iconBg, iconColor }) => (
  <div style={{
    background: "rgba(255,255,255,0.38)",
    backdropFilter: "blur(22px)",
    WebkitBackdropFilter: "blur(22px)",
    borderRadius: 16,
    padding: "14px 14px",
    display: "flex", flexDirection: "column", gap: 8,
    border: "1px solid rgba(255,255,255,0.60)",
    flex: "1 1 0", minWidth: 0,
    boxShadow: "0 6px 24px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.55)",
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: "rgba(255,255,255,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#1B4332" }}>
        {value}<span style={{ fontSize: 11, fontWeight: 500, color: "#40916C", marginLeft: 2 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: "#2D6A4F", marginTop: 1 }}>{label}</div>
    </div>
  </div>
);

/* ── NOTIFICATION ROW ───────────────────────────────────────── */
const NotifRow = ({ dot, title, body, time, onClick }) => (
  <div onClick={onClick} style={{
    display: "flex", gap: 12, alignItems: "flex-start",
    padding: "10px 0",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    cursor: onClick ? "pointer" : "default",
  }}>
    <div style={{
      width: 9, height: 9, borderRadius: "50%",
      background: dot, flexShrink: 0, marginTop: 5,
    }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1B4332", marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: "#374151", lineHeight: 1.4 }}>{body}</div>
    </div>
    <div style={{ fontSize: 10.5, color: "#6B7280", flexShrink: 0 }}>{time}</div>
  </div>
);

/* ════════════════════════════════════════════════════════════
   MAIN DASHBOARD
════════════════════════════════════════════════════════════ */
export const HomeDashboardLight = ({ navigate, me, projects, resumeProject }) => {
  const firstName = me?.name?.split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const hasProjects = Array.isArray(projects) && projects.length > 0;
  const hasCompletedGarden = Array.isArray(projects) &&
    projects.some(p => p.status === "Completed" || p.status === "Installed");


  return (
    <div style={{
      background: "transparent",
      height: "100%",
      fontFamily: "'DM Sans', 'Inter', 'Helvetica Neue', sans-serif",
      display: "flex", flexDirection: "column",
      maxWidth: 430, margin: "0 auto",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* ── TOP NAV ────────────────────────────────────────── */}
      <div style={{
        background: "rgba(10,45,18,0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        paddingTop: "calc(env(safe-area-inset-top, 44px) + 14px)",
        paddingBottom: "14px",
        paddingLeft: "20px",
        paddingRight: "20px",
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        {/* logo mark */}
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: L.heroBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <LeafIcon c="rgba(255,255,255,0.9)" />
        </div>
        <span style={{
          fontSize: 17, fontWeight: 800,
          color: "#FFFFFF", letterSpacing: -0.4,
        }}>HeatWise</span>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button onClick={() => navigate?.("notifications")} style={{ background: "none", border: "none", cursor: "pointer", position: "relative", padding: 0, display: "flex" }}>
            <BellIcon c="rgba(255,255,255,0.85)" />
            <div style={{
              position: "absolute", top: -2, right: -2,
              width: 7, height: 7, borderRadius: "50%",
              background: "#EF4444",
              border: "1.5px solid rgba(10,14,28,0.8)",
            }} />
          </button>
          <button onClick={() => navigate?.("settings")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: L.cardGreen,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: `2px solid ${L.greenLight}`,
            }}>
              <UserIcon c={L.greenText} />
            </div>
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 32, WebkitOverflowScrolling: "touch" }}>

        {/* ── HERO CARD ──────────────────────────────────── */}
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{
            background: L.heroBg,
            borderRadius: 22,
            padding: "22px 20px 20px",
            position: "relative",
            overflow: "hidden",
            minHeight: 180,
          }}>
            {/* decorative leaf shapes */}
            <div style={{
              position: "absolute", top: -20, right: -20,
              width: 120, height: 120, borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
            }} />
            <div style={{
              position: "absolute", bottom: -30, right: 20,
              width: 80, height: 80, borderRadius: "50%",
              background: "rgba(255,255,255,0.04)",
            }} />
            <div style={{
              position: "absolute", top: 10, right: 10,
              opacity: 0.12, fontSize: 90, lineHeight: 1,
              userSelect: "none",
            }}>🌿</div>

            <div style={{ position: "relative", zIndex: 2 }}>
              <div style={{
                fontSize: 10.5, fontWeight: 700,
                color: "rgba(255,255,255,0.65)",
                letterSpacing: 1.8, textTransform: "uppercase",
                marginBottom: 6,
              }}>{greeting}, {firstName}</div>

              {hasCompletedGarden ? (
                <>
                  <div style={{
                    fontSize: 24, fontWeight: 800,
                    color: "#fff", lineHeight: 1.2, marginBottom: 16,
                    letterSpacing: -0.5,
                  }}>
                    Your Rooftop<br />Heat Score: <span style={{ color: L.greenLight }}>72</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <StatPill icon={ThermIcon} label="34°C Outside" />
                    <StatPill icon={SunIcon} label="High UV" />
                    <StatPill icon={DropIcon} label="42% Humidity" />
                    <StatPill icon={WindIcon} label="12 km/h Wind" />
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: 22, fontWeight: 800,
                    color: "#fff", lineHeight: 1.3, marginBottom: 10,
                    letterSpacing: -0.3,
                  }}>
                    {hasProjects
                      ? <>Complete your garden<br />to unlock <span style={{ color: L.greenLight }}>Heat Score</span> 🌿</>
                      : <>Start your first<br /><span style={{ color: L.greenLight }}>Green Garden</span> 🌱</>
                    }
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.70)", marginBottom: 14, lineHeight: 1.5 }}>
                    {hasProjects
                      ? "Your heat score calculates once your garden is installed."
                      : "Create and complete a garden project to see your personalised rooftop heat score."}
                  </div>
                  {/* locked score preview */}
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 8,
                    background: "rgba(255,255,255,0.12)",
                    border: "1.5px dashed rgba(255,255,255,0.35)",
                    borderRadius: 14, padding: "8px 16px", marginBottom: 14,
                  }}>
                    <span style={{ fontSize: 18 }}>🔒</span>
                    <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>Heat Score locked</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
                      color: "#FCD34D", background: "rgba(251,191,36,0.18)",
                      border: "1px solid rgba(251,191,36,0.4)",
                      borderRadius: 20, padding: "2px 8px",
                    }}>PENDING</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <StatPill icon={ThermIcon} label="34°C Outside" />
                    <StatPill icon={SunIcon} label="High UV" />
                    <StatPill icon={DropIcon} label="42% Humidity" />
                    <StatPill icon={WindIcon} label="12 km/h Wind" />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── QUICK ACTIONS ──────────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 14,
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>
              Quick Actions
            </span>
            <button onClick={() => navigate?.("speciesLib")} style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "#52E8A0",
            }}>See all</button>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <ActionCard bg={L.cardGreen}  iconColor={L.iconGreen}  Icon={PlusIcon}   label="New Project"  onClick={() => navigate?.("create")} />
            <ActionCard bg={L.cardBlue}   iconColor={L.iconBlue}   Icon={CameraIcon} label="Scan Space"   onClick={() => navigate?.("measure")} />
            <ActionCard bg={L.cardAmber}  iconColor={L.iconAmber}  Icon={ChartIcon}  label="AI Analysis"  onClick={() => navigate?.("climateSpecies")} />
            <ActionCard bg={L.cardPurple} iconColor={L.iconPurple} Icon={LeafIcon}   label="Garden Plan"  onClick={() => navigate?.("gardenLayout")} />
          </div>
        </div>

        {/* ── MY IMPACT ──────────────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>My Impact</span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1,
              color: "#FCD34D", background: "rgba(251,191,36,0.18)",
              border: "1px solid rgba(251,191,36,0.40)",
              borderRadius: 20, padding: "3px 10px",
            }}>COMING SOON</span>
          </div>
          <div style={{
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1.5px dashed rgba(255,255,255,0.35)",
            borderRadius: 20, padding: "28px 20px",
            textAlign: "center",
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
            position: "relative", overflow: "hidden",
          }}>
            {/* decorative blur orbs */}
            <div style={{ position:"absolute", top:-30, right:-30, width:100, height:100, borderRadius:"50%", background:"rgba(52,211,153,0.15)", filter:"blur(24px)", pointerEvents:"none" }}/>
            <div style={{ position:"absolute", bottom:-20, left:-20, width:80, height:80, borderRadius:"50%", background:"rgba(56,189,248,0.12)", filter:"blur(20px)", pointerEvents:"none" }}/>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#FFFFFF", marginBottom: 6 }}>
              Impact Dashboard
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.70)", lineHeight: 1.65, maxWidth: 230, margin: "0 auto 18px" }}>
              Live CO₂ offset, temperature reduction &amp; energy savings — tracked automatically once your garden is installed.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              {[
                { icon: "🌡", label: "Temp Drop" },
                { icon: "🌿", label: "CO₂ Saved" },
                { icon: "⚡", label: "Energy" },
              ].map(item => (
                <div key={item.label} style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.22)",
                  borderRadius: 14, padding: "10px 14px",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  filter: "blur(0px)",
                  opacity: 0.55,
                }}>
                  <div style={{ fontSize: 20 }}>{item.icon}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: -0.5 }}>—</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", fontWeight: 600 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ACTIVE PROJECTS ────────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 14,
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>
              Active Projects
            </span>
            {hasProjects && (
              <button onClick={() => navigate?.("saved")} style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: "#52E8A0",
              }}>View all</button>
            )}
          </div>

          {hasProjects ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Show only the most recent project */}
              {(() => { const p = projects[0]; return (
                <ProjectCard
                  key={p.id || 0}
                  title={p.name || "Untitled Project"}
                  type={p.surfaceType || "Rooftop"}
                  area={p.area ? `${p.area} m²` : "—"}
                  status={p.status || "Draft"}
                  heatReduction="—"
                  lastUpdated={p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ""}
                  aiStatus={p.status === "Completed" ? "Installed" : "AI Ready"}
                  aiColor={p.status === "Completed" ? L.greenText : L.orange}
                  onClick={() => {
                    if (p.id && resumeProject) {
                      resumeProject(p.id).catch(() => navigate?.("result"));
                    } else {
                      navigate?.("result");
                    }
                  }}
                />
              ); })()}
              {/* See all row — only if more than 1 project */}
              {projects.length > 1 && (
                <button onClick={() => navigate?.("saved")} style={{
                  width: "100%", padding: "11px 16px",
                  background: "rgba(255,255,255,0.18)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1.5px solid rgba(255,255,255,0.35)",
                  borderRadius: 14, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>
                    View all {projects.length} projects
                  </span>
                  <span style={{ fontSize: 12, color: "#52E8A0", fontWeight: 700 }}>See all →</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{
              background: L.white, borderRadius: 18, padding: "24px 16px",
              border: `1.5px dashed ${L.greenPale}`, textAlign: "center",
            }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏡</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: L.textDark, marginBottom: 6 }}>
                No gardens yet
              </div>
              <div style={{ fontSize: 12, color: L.textGray, lineHeight: 1.6, marginBottom: 16 }}>
                Scan your rooftop, terrace or garden space. HeatWise will analyse it and generate a personalised green plan.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={() => navigate?.("create")} style={{
                  background: L.green, color: "#fff", border: "none",
                  borderRadius: 10, padding: "9px 16px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  + New Project
                </button>
                <button onClick={() => navigate?.("measure")} style={{
                  background: L.cardBlue, color: L.iconBlue, border: "none",
                  borderRadius: 10, padding: "9px 16px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  📷 Scan Space
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── AI INSIGHT BANNER ──────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{
            background: L.white,
            borderRadius: 18,
            padding: "16px 16px",
            border: `1.5px solid ${L.greenPale}`,
            boxShadow: L.shadow,
            display: "flex", gap: 14, alignItems: "flex-start",
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: L.cardGreen,
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, fontSize: 20,
            }}>🤖</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: L.greenText, marginBottom: 3 }}>
                {hasProjects ? "AI Insight" : "💡 Did you know?"}
              </div>
              <div style={{ fontSize: 12.5, color: L.textMid, lineHeight: 1.5 }}>
                {hasProjects
                  ? <>Vetiver grass placement on your west-facing wall could reduce surface temperature by an additional <strong>1.8°C</strong> this summer.</>
                  : <>Urban rooftops can be <strong>3–5°C hotter</strong> than surrounding areas. A green roof with the right plant mix can cut that by up to 70%.</>
                }
              </div>
              <button onClick={() => navigate?.("tips")} style={{
                marginTop: 8, background: "none", border: "none",
                cursor: "pointer", fontSize: 12, fontWeight: 600,
                color: L.greenText, padding: 0,
                display: "flex", alignItems: "center", gap: 3,
              }}>
                Learn more <ChevronRight c={L.greenText} />
              </button>
            </div>
          </div>
        </div>


        {/* ── SPECIES HIGHLIGHT ──────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: 12,
          }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>
              Top Species for You
            </span>
            <button style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: "#52E8A0",
            }} onClick={() => navigate?.("speciesLib")}>View all</button>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {[
              { name: "Vetiver",      score: 9, emoji: "🌾", note: "-4°C surface" },
              { name: "Areca Palm",   score: 8, emoji: "🌴", note: "Low water" },
              { name: "Moringa",      score: 7, emoji: "🌿", note: "Fast grow" },
              { name: "Bamboo",       score: 8, emoji: "🎋", note: "Wind shield" },
            ].map(sp => (
              <div key={sp.name} onClick={() => navigate?.("speciesLib")} style={{
                background: L.white,
                borderRadius: 16,
                padding: "14px 14px",
                flexShrink: 0,
                width: 110,
                border: `1px solid ${L.border}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                cursor: "pointer",
              }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>{sp.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: L.textDark, marginBottom: 2 }}>{sp.name}</div>
                <div style={{ fontSize: 10.5, color: L.textGray, marginBottom: 6 }}>{sp.note}</div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  <div style={{
                    flex: 1, height: 4, background: L.greenPale, borderRadius: 4,
                  }}>
                    <div style={{
                      width: `${sp.score * 10}%`, height: "100%",
                      background: L.greenText, borderRadius: 4,
                    }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: L.greenText }}>{sp.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CITY HEAT SNAPSHOT ─────────────────────────── */}
        <div style={{ padding: "20px 16px 24px" }}>
          <div style={{
            background: L.greenDark,
            borderRadius: 20,
            padding: "18px 18px",
            position: "relative", overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -10, right: -10,
              width: 90, height: 90, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
            }} />
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.55)",
              letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6,
            }}>City Heat Map</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
              Patiala — UHI Risk: High
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 14 }}>
              34% of city rooftops tracked · 2,140 sqm greened this month
            </div>
            <button onClick={() => navigate?.("cityHeat")} style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 12, padding: "8px 16px",
              cursor: "pointer",
              fontSize: 12, fontWeight: 600, color: "#fff",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              Open City Map <ChevronRight c="#fff" />
            </button>
          </div>
        </div>

      </div>{/* end scrollable body */}

    </div>
  );
};

export default HomeDashboardLight;

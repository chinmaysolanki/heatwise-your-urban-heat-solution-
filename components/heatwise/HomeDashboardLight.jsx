import React, { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────
   HEATWISE — Dashboard (updated for new 3-step scan flow)
   Palette: dark glass base · forest green hero · pastel cards
───────────────────────────────────────────────────────────── */

const L = {
  pageBg:    "#F2F3F7",
  white:     "#FFFFFF",
  heroBg:    "linear-gradient(160deg,#1B4332 0%,#2D6A4F 60%,#40916C 100%)",
  green:     "#2D6A4F",
  greenDark: "#1B4332",
  greenMid:  "#40916C",
  greenLight:"#74C69D",
  greenPale: "#D8F3DC",
  greenText: "#2D6A4F",
  cardGreen:  "#E8F5EC",
  cardBlue:   "#E3F0FD",
  cardAmber:  "#FFF4E1",
  cardPurple: "#F3E8FB",
  iconGreen:  "#2D6A4F",
  iconBlue:   "#1565C0",
  iconAmber:  "#D84315",
  iconPurple: "#6A1B9A",
  textDark:  "#111827",
  textMid:   "#374151",
  textGray:  "#6B7280",
  textLight: "#9CA3AF",
  orange:    "#E65100",
  orangeBg:  "#FFF0E6",
  border:    "rgba(0,0,0,0.07)",
  shadow:    "0 2px 12px rgba(0,0,0,0.07)",
  shadowMd:  "0 4px 20px rgba(0,0,0,0.10)",
};

/* ── tiny SVG icons ─────────────────────────────────────────── */
const CameraIcon = ({ c }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);
const LeafIcon = ({ c }) => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/>
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
  </svg>
);
const BellIcon = ({ c = "rgba(255,255,255,0.85)" }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
);
const UserIcon = ({ c = L.greenText }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
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
  <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.85)" stroke="none">
    <path d="M12 2C6 8 4 13 4 16a8 8 0 0016 0c0-3-2-8-8-14z"/>
  </svg>
);
const WindIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
  </svg>
);
const ChevronRight = ({ c = "#52E8A0" }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
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
  Rooftop:   "rgba(27,67,50,0.45)",
  Balcony:   "rgba(21,94,117,0.40)",
  Terrace:   "rgba(120,53,15,0.38)",
  Backyard:  "rgba(6,78,59,0.42)",
  Courtyard: "rgba(67,20,7,0.38)",
  Indoor:    "rgba(49,46,129,0.38)",
};

const ProjectCard = ({ title, type, area, image, status, lastUpdated, aiStatus, aiColor, onClick }) => {
  const tint = TYPE_TINTS[type] || TYPE_TINTS.Rooftop;
  return (
    <div onClick={onClick} style={{
      background: "rgba(255,255,255,0.38)",
      backdropFilter: "blur(22px)",
      WebkitBackdropFilter: "blur(22px)",
      borderRadius: 20, overflow: "hidden",
      boxShadow: "0 6px 28px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.55)",
      border: "1px solid rgba(255,255,255,0.60)",
      cursor: onClick ? "pointer" : "default",
    }}>
      <div style={{ display: "flex", alignItems: "stretch", height: 80 }}>
        <div style={{ position: "relative", width: 90, flexShrink: 0, overflow: "hidden" }}>
          <img src={image || "/garden-bg.webp"} alt={title}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 55%" }}
            onError={e => { e.target.src = "/garden-bg.webp"; }} />
          <div style={{ position: "absolute", inset: 0, background: tint }} />
        </div>
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

/* ── DAILY CHALLENGE ────────────────────────────────────────── */
const CHALLENGES = [
  { emoji: "💧", title: "Water your plants", body: "Give every pot a slow, deep soak — morning watering reduces evaporation by 40%.", points: 10, tag: "Care" },
  { emoji: "🌡", title: "Check heat pockets", body: "Touch your west-facing wall at noon. If it's hot, that's a prime spot for Vetiver or a trellis plant.", points: 15, tag: "Heat" },
  { emoji: "🌿", title: "Snap a new space", body: "Found a bare ledge or unused corner? Scan it with HeatWise for an instant plant recommendation.", points: 20, tag: "Scan" },
  { emoji: "🌱", title: "Repot one plant", body: "A root-bound plant can't absorb enough water. Move it to a pot 5 cm wider for an instant growth boost.", points: 12, tag: "Care" },
  { emoji: "☀️", title: "Track sun movement", body: "Note where direct sun hits your space from 10am–2pm. That's your 'full sun' zone for heat-tolerant species.", points: 15, tag: "Climate" },
  { emoji: "🪴", title: "Add a cooling plant", body: "One Areca Palm can transpire up to 1L of water a day — that's a built-in air cooler.", points: 20, tag: "Species" },
  { emoji: "🔍", title: "Inspect for pests", body: "Check leaf undersides for white spots or webs. Catching mites early saves the whole plant.", points: 10, tag: "Care" },
];

const DailyChallenge = ({ navigate }) => {
  const dayIdx = new Date().getDate() % CHALLENGES.length;
  const c = CHALLENGES[dayIdx];

  const storageKey = `hw_challenge_${new Date().toDateString()}`;
  const [done, setDone] = React.useState(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  const streakKey = "hw_challenge_streak";
  const [streak, setStreak] = React.useState(() => {
    try { return parseInt(localStorage.getItem(streakKey) || "0", 10); } catch { return 0; }
  });

  const markDone = () => {
    if (done) return;
    const newStreak = streak + 1;
    setDone(true);
    setStreak(newStreak);
    try {
      localStorage.setItem(storageKey, "1");
      localStorage.setItem(streakKey, String(newStreak));
    } catch { /* ignore */ }
  };

  return (
    <div style={{ padding: "20px 16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>Today's Challenge</span>
        {streak > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 5,
            background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)",
            borderRadius: 20, padding: "4px 10px",
          }}>
            <span style={{ fontSize: 13 }}>🔥</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#FCD34D" }}>{streak} day streak</span>
          </div>
        )}
      </div>

      <div style={{
        background: done
          ? "linear-gradient(135deg,rgba(34,197,94,0.18),rgba(27,67,50,0.55))"
          : "rgba(255,255,255,0.38)",
        backdropFilter: "blur(22px)",
        WebkitBackdropFilter: "blur(22px)",
        borderRadius: 20, overflow: "hidden",
        border: done ? "1.5px solid rgba(82,183,136,0.5)" : "1px solid rgba(255,255,255,0.60)",
        boxShadow: done ? "0 0 24px rgba(82,183,136,0.18)" : "0 6px 28px rgba(0,0,0,0.22)",
        transition: "all .35s ease",
      }}>
        <div style={{ padding: "18px 16px" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            {/* Big emoji with glow */}
            <div style={{
              width: 56, height: 56, borderRadius: 16, flexShrink: 0,
              background: done ? "rgba(82,183,136,0.25)" : "rgba(255,255,255,0.25)",
              border: done ? "2px solid rgba(82,183,136,0.6)" : "1.5px solid rgba(255,255,255,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26,
              boxShadow: done ? "0 0 16px rgba(82,183,136,0.3)" : "none",
              transition: "all .3s",
            }}>
              {done ? "✅" : c.emoji}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: done ? "#74C69D" : L.textDark }}>
                  {c.title}
                </span>
                <span style={{
                  fontSize: 9.5, fontWeight: 700,
                  background: done ? "rgba(82,183,136,0.2)" : L.cardGreen,
                  color: done ? "#74C69D" : L.greenText,
                  border: `1px solid ${done ? "rgba(82,183,136,0.4)" : L.greenPale}`,
                  borderRadius: 20, padding: "2px 8px",
                }}>{c.tag}</span>
              </div>
              <div style={{ fontSize: 12, color: done ? "rgba(255,255,255,0.60)" : L.textMid, lineHeight: 1.55 }}>
                {c.body}
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
            <button
              onClick={markDone}
              disabled={done}
              style={{
                flex: 1, padding: "11px 0", borderRadius: 12, border: "none",
                background: done
                  ? "rgba(82,183,136,0.25)"
                  : "linear-gradient(135deg,#2D6A4F,#52B788)",
                color: done ? "#74C69D" : "#fff",
                fontSize: 13, fontWeight: 800, cursor: done ? "default" : "pointer",
                letterSpacing: 0.2, transition: "all .25s",
                boxShadow: done ? "none" : "0 4px 14px rgba(45,106,79,0.4)",
              }}>
              {done ? "✓ Done — come back tomorrow!" : `Mark Done  +${c.points}pts`}
            </button>

            {c.tag === "Scan" && !done && (
              <button onClick={() => navigate?.("create")} style={{
                padding: "11px 14px", borderRadius: 12, border: "1.5px solid rgba(56,189,248,0.35)",
                background: "rgba(56,189,248,0.1)", cursor: "pointer",
                fontSize: 12, fontWeight: 700, color: "#38BDF8",
              }}>📷</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════════════════
   MAIN DASHBOARD
════════════════════════════════════════════════════════════ */
export const HomeDashboardLight = ({ navigate, me, projects, resumeProject, startFreshScan }) => {
  const scanNow = startFreshScan ?? (() => navigate?.("measure"));
  // Prefer server me, fall back to locally-saved profile (set during onboarding)
  const localName = (() => { try { return JSON.parse(localStorage.getItem("hw_profile") || "null")?.name; } catch { return null; } })();
  const firstName = (me?.name || localName || "").split(" ")[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const hasProjects = Array.isArray(projects) && projects.length > 0;
  const hasCompletedGarden = Array.isArray(projects) &&
    projects.some(p => p.status === "Completed" || p.status === "Installed");

  /* live heat stats from browser geolocation → open-meteo */
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(async pos => {
      try {
        const r = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,uv_index&wind_speed_unit=kmh&timezone=auto`
        );
        const d = await r.json();
        if (d?.current) setWeather(d.current);
      } catch { /* silent */ }
    }, () => {});
  }, []);

  const tempLabel  = weather ? `${Math.round(weather.temperature_2m)}°C` : "34°C";
  const uvLabel    = weather ? (weather.uv_index >= 8 ? "Very High UV" : weather.uv_index >= 5 ? "High UV" : "Moderate UV") : "High UV";
  const humLabel   = weather ? `${Math.round(weather.relative_humidity_2m)}% Humidity` : "42% Humidity";
  const windLabel  = weather ? `${Math.round(weather.wind_speed_10m)} km/h` : "12 km/h";

  return (
    <div style={{
      background: "transparent",
      height: "100%",
      fontFamily: "'DM Sans', 'Inter', 'Helvetica Neue', sans-serif",
      display: "flex", flexDirection: "column",
      maxWidth: 430, margin: "0 auto",
      position: "relative", overflow: "hidden",
    }}>

      {/* ── TOP NAV ─────────────────────────────────────────── */}
      <div style={{
        background: "rgba(10,45,18,0.72)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        paddingTop: "calc(env(safe-area-inset-top, 44px) + 14px)",
        paddingBottom: "14px",
        paddingLeft: "20px", paddingRight: "20px",
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: L.heroBg,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <LeafIcon c="rgba(255,255,255,0.9)" />
        </div>
        <span style={{ fontSize: 17, fontWeight: 800, color: "#FFFFFF", letterSpacing: -0.4 }}>HeatWise</span>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <button onClick={() => navigate?.("notifications")} style={{ background: "none", border: "none", cursor: "pointer", position: "relative", padding: 0, display: "flex" }}>
            <BellIcon />
            <div style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", background: "#EF4444", border: "1.5px solid rgba(10,14,28,0.8)" }} />
          </button>
          <button onClick={() => navigate?.("settings")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: L.cardGreen, display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${L.greenLight}` }}>
              <UserIcon />
            </div>
          </button>
        </div>
      </div>

      {/* ── SCROLLABLE BODY ─────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 36, WebkitOverflowScrolling: "touch" }}>

        {/* ── HERO + SCAN CARD (combined) ──────────────────── */}
        <div style={{ padding: "16px 16px 0" }}>
          <style>{`
            @keyframes shimmerSweep{0%{left:-80%}100%{left:120%}}
            @keyframes scanPulse{0%,100%{box-shadow:0 0 0 0 rgba(148,213,177,0.5)}60%{box-shadow:0 0 0 12px rgba(148,213,177,0)}}
          `}</style>
          <div style={{
            background: L.heroBg, borderRadius: 24,
            position: "relative", overflow: "hidden",
            boxShadow: "0 10px 40px rgba(27,67,50,0.6)",
          }}>
            {/* shimmer */}
            <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, bottom: 0, width: "55%",
                background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)",
                animation: "shimmerSweep 3s ease-in-out infinite" }} />
            </div>
            {/* decorative orbs */}
            <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
            <div style={{ position: "absolute", bottom: -20, left: -20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
            <div style={{ position: "absolute", top: 12, right: 14, opacity: 0.09, fontSize: 100, lineHeight: 1, userSelect: "none" }}>🌿</div>

            <div style={{ position: "relative", zIndex: 2, padding: "22px 20px 22px" }}>
              {/* greeting */}
              <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                {greeting}, {firstName}
              </div>

              {/* headline */}
              {hasCompletedGarden ? (
                <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 16, letterSpacing: -0.5 }}>
                  Heat Score: <span style={{ color: L.greenLight }}>72</span> 🌿
                </div>
              ) : (
                <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.3, marginBottom: 4, letterSpacing: -0.3 }}>
                  {hasProjects
                    ? <>Finish your scan,<br />unlock your <span style={{ color: L.greenLight }}>garden plan</span></>
                    : <>Turn your rooftop into<br />a <span style={{ color: "#95D5B2" }}>cool green space</span> 🌱</>
                  }
                </div>
              )}

              {!hasCompletedGarden && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", marginBottom: 18, lineHeight: 1.5 }}>
                  {hasProjects ? "Continue where you left off — we'll detect your climate and build your plant plan." : "Scan your space in minutes. We detect your climate, suggest species, and build an AI garden layout."}
                </div>
              )}

              {/* ── BIG SCAN BUTTON ── */}
              <button
                onClick={scanNow}
                style={{
                  width: "100%", padding: "15px 0",
                  borderRadius: 16, border: "none",
                  background: "rgba(255,255,255,0.94)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  fontSize: 15, fontWeight: 800, color: L.greenDark,
                  letterSpacing: 0.2, marginBottom: 12,
                  animation: "scanPulse 2.4s ease-in-out infinite",
                  boxShadow: "0 6px 22px rgba(0,0,0,0.25)",
                }}
                onMouseDown={e => { e.currentTarget.style.transform = "scale(0.97)"; e.currentTarget.style.animation = "none"; }}
                onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.animation = "scanPulse 2.4s ease-in-out infinite"; }}
                onTouchStart={e => { e.currentTarget.style.transform = "scale(0.97)"; e.currentTarget.style.animation = "none"; }}
                onTouchEnd={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.animation = "scanPulse 2.4s ease-in-out infinite"; }}
              >
                <span style={{ fontSize: 20 }}>📷</span>
                <span>Scan with us →</span>
              </button>

              {/* Step chips row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 16, flexWrap: "nowrap" }}>
                {[["📐","Measure"],["›",null],["📍","Location"],["›",null],["🏡","Details"],["›",null],["🌿","AI Plan"]].map(([e, l], i) =>
                  l === null
                    ? <span key={i} style={{ color: "rgba(255,255,255,0.28)", fontSize: 13 }}>{e}</span>
                    : <div key={l} style={{
                        display: "flex", alignItems: "center", gap: 4,
                        background: "rgba(255,255,255,0.12)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        borderRadius: 20, padding: "4px 9px", flexShrink: 0,
                      }}>
                        <span style={{ fontSize: 11 }}>{e}</span>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.80)" }}>{l}</span>
                      </div>
                )}
              </div>

              {/* Live weather pills */}
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <StatPill icon={ThermIcon} label={tempLabel} />
                <StatPill icon={SunIcon} label={uvLabel} />
                <StatPill icon={DropIcon} label={humLabel} />
                <StatPill icon={WindIcon} label={windLabel} />
              </div>
              {weather && (
                <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.32)", marginTop: 5, fontStyle: "italic" }}>Live weather · updates on each visit</div>
              )}
            </div>
          </div>
        </div>

        {/* ── ACTIVE PROJECTS ─────────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>Active Projects</span>
            {hasProjects && (
              <button onClick={() => navigate?.("saved")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#52E8A0" }}>
                View all
              </button>
            )}
          </div>

          {hasProjects ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(() => { const p = projects[0]; return (
                <ProjectCard
                  key={p.id || 0}
                  title={p.name || "Untitled Project"}
                  type={p.surfaceType || "Rooftop"}
                  area={p.area ? `${p.area} m²` : "—"}
                  status={p.status || "Draft"}
                  lastUpdated={p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : ""}
                  aiStatus={p.status === "Completed" ? "Installed" : "AI Ready"}
                  aiColor={p.status === "Completed" ? L.greenText : L.orange}
                  onClick={() => {
                    if (p.id && resumeProject) resumeProject(p.id).catch(() => navigate?.("result"));
                    else navigate?.("result");
                  }}
                />
              ); })()}
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>View all {projects.length} projects</span>
                  <span style={{ fontSize: 12, color: "#52E8A0", fontWeight: 700 }}>See all →</span>
                </button>
              )}
            </div>
          ) : (
            <div style={{
              background: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(16px)",
              borderRadius: 18, padding: "26px 16px",
              border: "1.5px dashed rgba(255,255,255,0.22)", textAlign: "center",
            }}>
              <div style={{ fontSize: 38, marginBottom: 10 }}>🏡</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>No gardens yet</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.60)", lineHeight: 1.6, marginBottom: 16 }}>
                Scan your rooftop, terrace or balcony. HeatWise detects your climate, suggests species, and builds a personalised plant plan.
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                <button onClick={scanNow} style={{
                  background: L.greenMid, color: "#fff", border: "none",
                  borderRadius: 10, padding: "9px 20px",
                  fontSize: 12, fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 4px 14px rgba(45,106,79,0.4)",
                }}>📷 Scan with us →</button>
                <button onClick={() => navigate?.("speciesLib")} style={{
                  background: "rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 10, padding: "9px 16px",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>Browse Species</button>
              </div>
            </div>
          )}
        </div>

        {/* ── DAILY CHALLENGE ─────────────────────────────── */}
        <DailyChallenge navigate={navigate} />

        {/* ── TOP SPECIES FOR YOU ──────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#FFFFFF" }}>Top Species for You</span>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#52E8A0" }}
              onClick={() => navigate?.("speciesLib")}>View all</button>
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
            {[
              { name: "Vetiver",     score: 9, emoji: "🌾", note: "−4°C surface",  tag: "Extreme heat" },
              { name: "Areca Palm",  score: 8, emoji: "🌴", note: "Low water",     tag: "Drought safe" },
              { name: "Moringa",     score: 7, emoji: "🌿", note: "Fast grow",     tag: "High cooling" },
              { name: "Bamboo",      score: 8, emoji: "🎋", note: "Wind shield",   tag: "Privacy" },
              { name: "Tulsi",       score: 6, emoji: "🌿", note: "Indoor-ok",     tag: "Low light" },
            ].map(sp => (
              <div key={sp.name} onClick={() => navigate?.("speciesLib")} style={{
                background: L.white, borderRadius: 16,
                padding: "14px 12px", flexShrink: 0, width: 108,
                border: `1px solid ${L.border}`,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                cursor: "pointer",
              }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>{sp.emoji}</div>
                <div style={{ fontSize: 12, fontWeight: 800, color: L.textDark, marginBottom: 2 }}>{sp.name}</div>
                <div style={{ fontSize: 9.5, color: L.textGray, marginBottom: 4 }}>{sp.note}</div>
                <div style={{ fontSize: 9, color: L.greenText, background: L.cardGreen, borderRadius: 20, padding: "2px 7px", display: "inline-block", fontWeight: 700, marginBottom: 6 }}>{sp.tag}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{ flex: 1, height: 4, background: L.greenPale, borderRadius: 4 }}>
                    <div style={{ width: `${sp.score * 10}%`, height: "100%", background: L.greenText, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: L.greenText }}>{sp.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── AI INSIGHT ──────────────────────────────────── */}
        <div style={{ padding: "20px 16px 0" }}>
          <div style={{
            background: L.white, borderRadius: 18,
            padding: "16px", border: `1.5px solid ${L.greenPale}`,
            boxShadow: L.shadow, display: "flex", gap: 14, alignItems: "flex-start",
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
                  ? <>Vetiver grass on your west-facing wall could reduce surface temperature by an additional <strong>1.8°C</strong> this summer.</>
                  : <>Urban rooftops can be <strong>3–5°C hotter</strong> than surrounding areas. A species-matched green roof can cut that by up to <strong>70%</strong>.</>
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

        {/* ── CITY HEAT SNAPSHOT ──────────────────────────── */}
        <div style={{ padding: "20px 16px 24px" }}>
          <div style={{
            background: L.greenDark, borderRadius: 20,
            padding: "18px", position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: -10, right: -10, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.55)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>City Heat Map</div>
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
              cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#fff",
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

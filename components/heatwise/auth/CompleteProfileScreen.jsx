import { useCallback, useMemo, useState } from "react";
import { T } from "@/components/heatwise/theme";

export function CompleteProfileScreen({ initialProfile, onCompleted, onSkip }) {
  const [email, setEmail] = useState(initialProfile?.email ?? "");
  const [city, setCity] = useState(initialProfile?.city ?? "");
  const [state, setState] = useState(initialProfile?.state ?? "");
  const [country, setCountry] = useState(initialProfile?.country ?? "India");
  const [age, setAge] = useState(initialProfile?.age ?? "");
  const [score, setScore] = useState(initialProfile?.gardeningInterestScore ?? 5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const valid = useMemo(() => {
    const a = Number(age);
    return (
      String(email).includes("@") &&
      city.trim().length > 1 &&
      state.trim().length > 1 &&
      country.trim().length > 1 &&
      Number.isFinite(a) &&
      a >= 1 &&
      a <= 120 &&
      score >= 1 &&
      score <= 10
    );
  }, [age, city, country, email, score, state]);

  const submit = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          city,
          state,
          country,
          age: Number(age),
          gardeningInterestScore: score,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Failed to update profile");
      onCompleted?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile");
    } finally {
      setBusy(false);
    }
  }, [age, city, country, email, onCompleted, score, state]);

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <div className="auth-brand-line" />
      <div className="mono" style={{ color: T.green, letterSpacing: "4px", fontSize: 10, marginBottom: 6 }}>PROFILE</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: T.textBright, lineHeight: 1.15 }}>
        Complete your profile
      </div>
      <div style={{ color: T.textDim, fontSize: 14, marginTop: 10, lineHeight: 1.55 }}>
        This helps us tailor recommendations and installer follow-ups.
      </div>

      <div style={{ marginTop: 22 }}>
        {[
          ["EMAIL", email, setEmail, "email", "you@example.com"],
          ["CITY", city, setCity, "text", "e.g. Pune"],
          ["STATE", state, setState, "text", "e.g. Maharashtra"],
          ["COUNTRY", country, setCountry, "text", "e.g. India"],
          ["AGE", age, setAge, "number", "e.g. 28"],
        ].map(([label, val, setter, type, placeholder]) => (
          <div key={label} style={{ marginBottom: 12 }}>
            <div className="slabel" style={{ marginBottom: 8 }}>{label}</div>
            <input
              className="hinp mono"
              value={val}
              onChange={e => setter(e.target.value)}
              type={type}
              inputMode={label === "AGE" ? "numeric" : undefined}
              placeholder={placeholder}
              disabled={busy}
            />
          </div>
        ))}

        <div style={{ marginTop: 14 }}>
          <div className="slabel" style={{ marginBottom: 12 }}>
            GARDENING INTEREST
          </div>
          {[
            { value: 2,  emoji: "🌱", label: "Just curious",    sub: "New to gardening" },
            { value: 5,  emoji: "🪴", label: "Hobby gardener",  sub: "I enjoy it casually" },
            { value: 8,  emoji: "🌿", label: "Enthusiast",      sub: "Spend time on it weekly" },
            { value: 10, emoji: "🌳", label: "Passionate",      sub: "It's a lifestyle" },
          ].map(opt => {
            const active = score === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={busy}
                onClick={() => setScore(opt.value)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  marginBottom: 8,
                  padding: "11px 14px",
                  background: active ? "rgba(82,183,136,0.13)" : "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${active ? "rgba(82,183,136,0.7)" : "rgba(184,220,192,0.13)"}`,
                  borderRadius: 12,
                  cursor: busy ? "not-allowed" : "pointer",
                  textAlign: "left",
                  transition: "all .18s",
                  boxShadow: active ? "0 0 12px rgba(82,183,136,0.18)" : "none",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{opt.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? T.green : "rgba(216,243,220,0.85)", letterSpacing: ".2px" }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 11, color: "rgba(184,220,192,0.5)", marginTop: 2 }}>
                    {opt.sub}
                  </div>
                </div>
                {active && (
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(82,183,136,0.2)", border: "2px solid rgba(82,183,136,0.8)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mono" style={{ marginTop: 12, fontSize: 11, color: T.orange, letterSpacing: "1px" }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <button type="button" className="gbtn fill" onClick={submit} disabled={busy || !valid}>
            {busy ? "SAVING…" : "SAVE & CONTINUE →"}
          </button>
          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              style={{
                background: "none",
                border: "none",
                color: T.textDim,
                fontSize: 13,
                cursor: "pointer",
                padding: "6px 0",
                textAlign: "center",
                opacity: busy ? 0.4 : 1,
              }}
            >
              Setup later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


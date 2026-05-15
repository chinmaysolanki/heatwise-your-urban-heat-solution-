import { useState, useRef, useEffect } from "react";

const C = {
  FOREST: "#1a3828",
  FOREST_MID: "#2a5c3e",
  GREEN: "#40b070",
  MINT: "#e0f5e8",
  CREAM: "#fafaf6",
  ERROR: "#c0392b",
};

/**
 * EmailVerification — standalone email OTP component.
 *
 * Props:
 *   initialEmail  — pre-fill the email input (optional)
 *   onVerified    — callback({ email }) called on success
 *   onSkip        — callback called if user dismisses (optional)
 *   compact       — render without card wrapper (default false)
 */
export default function EmailVerification({ initialEmail = "", onVerified, onSkip, compact = false }) {
  const [step, setStep] = useState("email"); // "email" | "otp" | "done"
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef([]);
  const cooldownRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(cooldownRef.current);
  }, []);

  function startCooldown(secs = 60) {
    setCooldown(secs);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) { clearInterval(cooldownRef.current); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  async function sendOtp(e) {
    e?.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/email/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Failed to send code.");
        if (res.status === 429) startCooldown(60);
      } else {
        setStep("otp");
        setOtp(["", "", "", "", "", ""]);
        startCooldown(60);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e) {
    e?.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) { setError("Enter the 6-digit code."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Incorrect code.");
      } else {
        setStep("done");
        onVerified?.({ email: email.trim() });
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpInput(i, val) {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[i] = val.slice(-1);
    setOtp(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join("").length === 6) {
      // Auto-submit when all digits filled
      setTimeout(() => {
        const code = next.join("");
        if (code.length === 6) verifyOtp();
      }, 80);
    }
  }

  function handleOtpKeyDown(i, e) {
    if (e.key === "Backspace" && !otp[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
  }

  function handleOtpPaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = [...otp];
    pasted.split("").forEach((d, i) => { if (i < 6) next[i] = d; });
    setOtp(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  const inner = (
    <div style={{ width: "100%" }}>
      {step === "done" ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", color: C.FOREST, margin: "0 0 8px", fontSize: 20 }}>Email verified!</h3>
          <p style={{ color: C.FOREST, opacity: 0.65, fontSize: 14, margin: 0 }}>{email}</p>
        </div>
      ) : (
        <>
          <h3 style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: 18, fontWeight: 700, color: C.FOREST, margin: "0 0 4px" }}>
            {step === "email" ? "Verify your email" : "Enter verification code"}
          </h3>
          <p style={{ fontSize: 13, color: C.FOREST, opacity: 0.6, margin: "0 0 20px" }}>
            {step === "email"
              ? "We'll send a 6-digit code to confirm your email address."
              : `Code sent to ${email}. It expires in 10 minutes.`}
          </p>

          {step === "email" ? (
            <form onSubmit={sendOtp}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "12px 16px", fontSize: 15,
                  border: `1.5px solid ${error ? C.ERROR : "rgba(26,56,40,0.2)"}`,
                  borderRadius: 10, outline: "none",
                  fontFamily: "inherit", background: "#fff",
                  color: C.FOREST, marginBottom: 8,
                }}
              />
              {error && <p style={{ color: C.ERROR, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%", padding: "12px", fontSize: 15, fontWeight: 700,
                  background: loading ? "rgba(64,176,112,0.5)" : C.GREEN,
                  color: "#fff", border: "none", borderRadius: 10,
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "'Space Grotesk',sans-serif",
                  transition: "opacity 0.2s",
                }}
              >
                {loading ? "Sending…" : "Send code"}
              </button>
              {onSkip && (
                <button
                  type="button"
                  onClick={onSkip}
                  style={{ width: "100%", marginTop: 10, padding: "10px", fontSize: 13,
                    background: "transparent", border: "1.5px solid rgba(26,56,40,0.15)",
                    borderRadius: 10, cursor: "pointer", color: C.FOREST, opacity: 0.6,
                    fontFamily: "inherit",
                  }}
                >
                  Skip for now
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={verifyOtp}>
              {/* 6-digit OTP boxes */}
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}
                onPaste={handleOtpPaste}>
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => (inputRefs.current[i] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    style={{
                      width: 44, height: 52, textAlign: "center",
                      fontSize: 22, fontWeight: 700,
                      border: `1.5px solid ${error ? C.ERROR : "rgba(26,56,40,0.25)"}`,
                      borderRadius: 10, outline: "none",
                      fontFamily: "'JetBrains Mono',monospace",
                      background: digit ? C.MINT : "#fff",
                      color: C.FOREST,
                      transition: "background 0.15s",
                    }}
                  />
                ))}
              </div>

              {error && <p style={{ color: C.ERROR, fontSize: 13, textAlign: "center", margin: "0 0 12px" }}>{error}</p>}

              <button
                type="submit"
                disabled={loading || otp.join("").length !== 6}
                style={{
                  width: "100%", padding: "12px", fontSize: 15, fontWeight: 700,
                  background: (loading || otp.join("").length !== 6) ? "rgba(64,176,112,0.4)" : C.GREEN,
                  color: "#fff", border: "none", borderRadius: 10,
                  cursor: (loading || otp.join("").length !== 6) ? "not-allowed" : "pointer",
                  fontFamily: "'Space Grotesk',sans-serif",
                  marginBottom: 10,
                }}
              >
                {loading ? "Verifying…" : "Verify email"}
              </button>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setError(""); setOtp(["","","","","",""]); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.FOREST, opacity: 0.55, padding: 0 }}
                >
                  ← Change email
                </button>
                <button
                  type="button"
                  onClick={sendOtp}
                  disabled={cooldown > 0 || loading}
                  style={{ background: "none", border: "none", cursor: cooldown > 0 ? "not-allowed" : "pointer",
                    fontSize: 13, color: cooldown > 0 ? "rgba(26,56,40,0.35)" : C.GREEN, padding: 0, fontWeight: 600 }}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );

  if (compact) return inner;

  return (
    <div style={{
      background: "#fff", borderRadius: 20, padding: "32px 28px",
      border: "1.5px solid rgba(26,56,40,0.12)",
      boxShadow: "0 4px 24px rgba(26,56,40,0.08)",
      maxWidth: 420, width: "100%", margin: "0 auto",
    }}>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 28 }}>🌿</span>
        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: 16, color: C.FOREST }}>HeatWise</span>
      </div>
      {inner}
    </div>
  );
}

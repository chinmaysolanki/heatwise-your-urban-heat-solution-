import { useCallback, useMemo, useState } from "react";
import { T } from "@/components/heatwise/theme";

export function PhoneLoginScreen({ onOtpSent }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [debugOtp, setDebugOtp] = useState(null);

  const normalizedPreview = useMemo(() => phoneNumber.trim(), [phoneNumber]);

  const sendOtp = useCallback(async () => {
    setBusy(true);
    setError(null);
    setDebugOtp(null);
    try {
      const res = await fetch("/api/phone-auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "Failed to send OTP");
      if (data?.debugOtp) setDebugOtp(String(data.debugOtp));
      onOtpSent?.({
        phoneNumber: data?.phoneNumber ?? phoneNumber,
        debugOtp: data?.debugOtp ? String(data.debugOtp) : null,
        otpDelivery: data?.delivery === "console" ? "console" : "sms",
        otpNotice: typeof data?.notice === "string" ? data.notice : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  }, [phoneNumber]);

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <div className="auth-brand-line" />
      <div className="mono" style={{ color: T.green, letterSpacing: "4px", fontSize: 10, marginBottom: 6 }}>
        HEATWISE
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: T.textBright, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
        Sign in
      </div>
      <div style={{ color: T.textDim, fontSize: 14, marginTop: 10, lineHeight: 1.55, maxWidth: 360 }}>
        Enter your mobile number. You’ll verify with a one-time code on the next step.
      </div>

      <div style={{ marginTop: 22 }}>
        <div className="slabel" style={{ marginBottom: 8 }}>
          Mobile number
        </div>
        <input
          className="hinp mono"
          value={phoneNumber}
          onChange={e => setPhoneNumber(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && normalizedPreview && !busy) void sendOtp();
          }}
          placeholder="+91 98765 43210"
          inputMode="tel"
          autoComplete="tel"
          disabled={busy}
        />

        {error && (
          <div className="mono" style={{ marginTop: 12, fontSize: 11, color: T.orange, letterSpacing: "0.5px" }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <button type="button" className="gbtn fill" onClick={() => void sendOtp()} disabled={busy || !normalizedPreview}>
            {busy ? "SENDING…" : "CONTINUE →"}
          </button>
        </div>

        {debugOtp && (
          <div
            className="mono"
            style={{
              marginTop: 16,
              fontSize: 11,
              padding: "12px 14px",
              borderRadius: 10,
              background: "rgba(0,255,136,.08)",
              border: "1px solid rgba(0,255,136,.22)",
              color: "rgba(224,245,232,.95)",
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: T.textDim }}>Your code (dev — no SMS):</span>{" "}
            <strong className="ng" style={{ letterSpacing: "3px" }}>
              {debugOtp}
            </strong>
          </div>
        )}
      </div>

      <p className="mono" style={{ marginTop: 18, color: "rgba(184,220,192,.45)", fontSize: 10, lineHeight: 1.6 }}>
        Local builds show the code on-screen and in the server terminal instead of SMS.
      </p>
    </div>
  );
}

import { useCallback, useState } from "react";
import { signIn } from "next-auth/react";
import { T } from "@/components/heatwise/theme";

export function OTPVerificationScreen({ phoneNumber, initialDebugOtp, otpDelivery, otpNotice, devToken: initialDevToken, expiresAt: initialExpiresAt, onBack, onAuthed }) {
  const [otp, setOtp] = useState(initialDebugOtp ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [debugOtp, setDebugOtp] = useState(initialDebugOtp ?? null);
  const [delivery, setDelivery] = useState(otpDelivery ?? "console");
  const [notice, setNotice] = useState(otpNotice ?? null);
  const [devToken, setDevToken] = useState(initialDevToken ?? null);
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt ?? null);

  const resend = useCallback(async () => {
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
      if (!res.ok) throw new Error(data?.message ?? "Failed to resend OTP");
      if (data?.debugOtp) setDebugOtp(String(data.debugOtp));
      if (data?.delivery === "console" || data?.delivery === "sms") setDelivery(data.delivery);
      if (typeof data?.notice === "string") setNotice(data.notice);
      if (data?.devToken)  setDevToken(data.devToken);
      if (data?.expiresAt) setExpiresAt(data.expiresAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resend OTP");
    } finally {
      setBusy(false);
    }
  }, [phoneNumber]);

  const verify = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        phoneNumber,
        otp,
        devToken:  devToken  ?? "",
        expiresAt: expiresAt ?? "",
      });
      if (!result || result.error) throw new Error(result?.error ?? "OTP verification failed");
      onAuthed?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "OTP verification failed");
    } finally {
      setBusy(false);
    }
  }, [onAuthed, otp, phoneNumber]);

  return (
    <div className="auth-card" style={{ margin: "0 auto" }}>
      <div className="auth-brand-line" />
      <div className="mono" style={{ color: T.green, letterSpacing: "4px", fontSize: 10, marginBottom: 6 }}>
        VERIFY
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: T.textBright, lineHeight: 1.15 }}>Enter code</div>
      <div style={{ color: T.textDim, fontSize: 14, marginTop: 10, lineHeight: 1.5 }}>
        Sent to{" "}
        <span className="mono" style={{ color: "rgba(0,255,136,.85)" }}>
          {phoneNumber}
        </span>
      </div>

      {delivery === "console" && (
        <div
          className="mono"
          style={{
            marginTop: 14,
            fontSize: 11,
            lineHeight: 1.55,
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(255,184,0,.1)",
            border: "1px solid rgba(255,184,0,.28)",
            color: "rgba(255,230,180,.95)",
          }}
        >
          {notice ||
            "No SMS in this environment. Use the code below or your dev server terminal ([HeatWise OTP])."}
        </div>
      )}

      <div style={{ marginTop: 22 }}>
        <div className="slabel" style={{ marginBottom: 8 }}>6-digit code</div>
        <input
          className="hinp mono"
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={e => {
            if (e.key === "Enter" && !busy && otp.trim().length >= 6) void verify();
          }}
          placeholder="• • • • • •"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          enterKeyHint="done"
          name="one-time-code"
          style={{ fontSize: 20, letterSpacing: "6px", textAlign: "center" }}
          disabled={busy}
        />

        {debugOtp && (
          <div
            className="mono"
            style={{
              marginTop: 14,
              fontSize: 11,
              padding: "10px 12px",
              borderRadius: 10,
              background: "rgba(0,255,136,.07)",
              border: "1px solid rgba(0,255,136,.2)",
            }}
          >
            Code: <strong className="ng" style={{ letterSpacing: "3px" }}>{debugOtp}</strong>
          </div>
        )}

        {error && (
          <div className="mono" style={{ marginTop: 12, fontSize: 11, color: T.orange, letterSpacing: "0.5px" }}>
            {error}
          </div>
        )}

        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          <button
            type="button"
            className="gbtn fill"
            onClick={() => void verify()}
            disabled={busy || otp.trim().length < 6}
            style={{ minHeight: 52, touchAction: "manipulation" }}
          >
            {busy ? "VERIFYING…" : "VERIFY →"}
          </button>
          <div style={{ display: "flex", gap: 10, width: "100%" }}>
            <button
              type="button"
              className="gbtn"
              onClick={onBack}
              disabled={busy}
              style={{ flex: 1, minWidth: 0, minHeight: 48, width: "auto", touchAction: "manipulation" }}
            >
              BACK
            </button>
            <button
              type="button"
              className="gbtn"
              onClick={() => void resend()}
              disabled={busy}
              style={{ flex: 1, minWidth: 0, minHeight: 48, width: "auto", touchAction: "manipulation" }}
            >
              RESEND
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

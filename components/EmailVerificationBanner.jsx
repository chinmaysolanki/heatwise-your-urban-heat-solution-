import { useState } from "react";
import EmailVerification from "@/components/EmailVerification";

/**
 * EmailVerificationBanner
 *
 * Shows a dismissible yellow nudge banner when `emailVerified` is false.
 * Clicking "Verify now" opens an inline modal.
 *
 * Props:
 *   email         — user's current email (string|null)
 *   emailVerified — boolean from /api/user/me
 *   onVerified    — optional callback({ email }) on success
 */
export default function EmailVerificationBanner({ email, emailVerified, onVerified }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [verified, setVerified] = useState(false);

  if (emailVerified || verified || dismissed || !email) return null;

  function handleVerified(result) {
    setVerified(true);
    setOpen(false);
    onVerified?.(result);
  }

  return (
    <>
      {/* Banner */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        background: "#fffbeb", border: "1px solid #f59e0b",
        borderRadius: 12, padding: "12px 16px",
        marginBottom: 16, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>📧</span>
        <div style={{ flex: 1, minWidth: 180 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: "#78350f" }}>Verify your email</p>
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#92400e", opacity: 0.85 }}>
            Confirm <strong>{email}</strong> to unlock full access.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: "7px 16px", fontSize: 13, fontWeight: 700,
              background: "#f59e0b", color: "#fff", border: "none",
              borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Verify now
          </button>
          <button
            onClick={() => setDismissed(true)}
            style={{
              padding: "7px 10px", fontSize: 18, lineHeight: 1,
              background: "transparent", border: "none",
              color: "#92400e", cursor: "pointer", opacity: 0.5,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      </div>

      {/* Inline modal */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ width: "100%", maxWidth: 440, position: "relative" }}>
            <button
              onClick={() => setOpen(false)}
              style={{
                position: "absolute", top: -12, right: -12, zIndex: 1,
                width: 32, height: 32, borderRadius: "50%",
                background: "#fff", border: "none", cursor: "pointer",
                fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              }}
              aria-label="Close"
            >
              ×
            </button>
            <EmailVerification
              initialEmail={email}
              onVerified={handleVerified}
              onSkip={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}

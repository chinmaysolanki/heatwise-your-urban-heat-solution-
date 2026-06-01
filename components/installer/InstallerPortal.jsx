import { useState, useEffect, useCallback, useRef } from "react";

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg: "#0a1628",
  surface: "#111e2e",
  surfaceHigh: "#162436",
  border: "rgba(56,189,248,0.14)",
  borderFocus: "rgba(56,189,248,0.45)",
  accent: "#38BDF8",
  green: "#4ade80",
  orange: "#fb923c",
  red: "#f87171",
  gold: "#fbbf24",
  textBright: "#e2f0ff",
  textMid: "rgba(186,230,253,0.75)",
  textDim: "rgba(186,230,253,0.42)",
  mono: "'JetBrains Mono', monospace",
  sans: "'DM Sans', sans-serif",
};

const STORAGE_KEY = "hw_installer_creds";

// ── Helpers ────────────────────────────────────────────────────────────────
function apiFetch(path, creds, opts = {}) {
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-heatwise-installer-token": creds.token,
      "x-heatwise-installer-id": creds.installerId,
      ...(opts.headers ?? {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
}

function fmt(date) {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  } catch { return "—"; }
}

function fmtInr(n) {
  if (n == null) return "—";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function regionLabel(r) { return r?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "Unknown"; }

// ── Primitive UI components ────────────────────────────────────────────────
function StatusChip({ status }) {
  const map = {
    invited: [T.orange, "PENDING QUOTE"],
    scheduled: [T.accent, "SCHEDULED"],
    started: [T.green, "IN PROGRESS"],
    completed: [T.green, "COMPLETED"],
    cancelled: [T.red, "CANCELLED"],
    declined: [T.red, "DECLINED"],
    verified: ["#a78bfa", "VERIFIED"],
    active: [T.green, "ACTIVE"],
    pending: [T.orange, "PENDING REVIEW"],
  };
  const [color, label] = map[status] ?? [T.textDim, (status ?? "").toUpperCase()];
  return (
    <span style={{ background: `${color}20`, border: `1px solid ${color}44`, color, borderRadius: 999, padding: "2px 10px", fontSize: 10, fontWeight: 700, fontFamily: T.mono, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function Label({ children }) {
  return <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: "0.1em", color: T.textDim, textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

function Input({ label, type = "text", value, onChange, placeholder, min }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <Label>{label}</Label>}
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} min={min}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: "100%", background: T.surfaceHigh, border: `1px solid ${focused ? T.borderFocus : T.border}`, borderRadius: 10, padding: "12px 14px", color: T.textBright, fontSize: 15, fontFamily: T.sans, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
      />
    </div>
  );
}

function Textarea({ label, value, onChange, placeholder, rows = 3 }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <Label>{label}</Label>}
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: "100%", background: T.surfaceHigh, border: `1px solid ${focused ? T.borderFocus : T.border}`, borderRadius: 10, padding: "12px 14px", color: T.textBright, fontSize: 14, fontFamily: T.sans, outline: "none", resize: "vertical", boxSizing: "border-box", transition: "border-color 0.2s" }}
      />
    </div>
  );
}

function Btn({ children, onClick, variant = "primary", disabled, style: extra }) {
  const [hov, setHov] = useState(false);
  const styles = {
    primary: { background: hov ? "#5ac8f0" : T.accent, color: "#0a1628", fontWeight: 700 },
    success: { background: hov ? "#6bef94" : T.green, color: "#0a1628", fontWeight: 700 },
    danger: { background: hov ? "#fca5a5" : "transparent", color: T.red, border: `1.5px solid ${T.red}` },
    ghost: { background: hov ? T.surfaceHigh : "transparent", color: T.textMid, border: `1px solid ${T.border}` },
  };
  return (
    <button
      onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: "12px 20px", borderRadius: 12, border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: T.sans, fontSize: 14, transition: "all 0.18s", opacity: disabled ? 0.45 : 1, ...styles[variant], ...extra }}
    >
      {children}
    </button>
  );
}

function Card({ children, onClick, style: extra }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: T.surface, border: `1px solid ${hov && onClick ? T.borderFocus : T.border}`, borderRadius: 16, padding: "18px 20px", cursor: onClick ? "pointer" : "default", transition: "border-color 0.2s", ...extra }}
    >
      {children}
    </div>
  );
}

// ── Bottom sheet panel ─────────────────────────────────────────────────────
function Sheet({ open, onClose, children, title }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: T.surface, borderRadius: "20px 20px 0 0", border: `1px solid ${T.border}`, borderBottom: "none", maxHeight: "90vh", display: "flex", flexDirection: "column", zIndex: 1 }}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontFamily: T.mono, fontSize: 12, letterSpacing: "0.1em", color: T.accent, textTransform: "uppercase" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "20px" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.textDim, fontFamily: T.sans }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: color ?? T.textBright, fontFamily: T.sans }}>{value}</span>
    </div>
  );
}

// ── Quote submission panel ─────────────────────────────────────────────────
function QuotePanel({ assignment, creds, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("7");
  const [scope, setScope] = useState("");
  const [species, setSpecies] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [declining, setDeclining] = useState(false);

  const qr = assignment.quoteRequest;
  const ps = qr.projectSnapshot ?? {};
  const cs = qr.candidateSnapshot ?? {};

  const estimatedCost = cs?.candidate?.estimatedInstallCostInr ?? ps?.estimatedCost ?? null;
  const spaceType = ps?.project?.space_type ?? ps?.space_type ?? null;
  const area = ps?.project?.area_m2 ?? null;
  const purposePrimary = ps?.preferences?.purpose_primary ?? null;

  async function submit() {
    if (!amount || Number(amount) <= 0) { setErr("Enter a valid quote amount"); return; }
    setLoading(true); setErr("");
    const res = await apiFetch("/api/installers/installer-submit-quote", creds, {
      method: "POST",
      body: {
        quoteRequestId: assignment.quoteRequestId,
        quoteAssignmentId: assignment.id,
        quoteAmountInr: Number(amount),
        estimatedTimelineDays: Number(days) || 7,
        includedScope: { description: scope || "Standard green canopy installation", items: scope.split("\n").filter(Boolean) },
        proposedSpecies: species ? species.split(",").map(s => s.trim()).filter(Boolean) : null,
        notes: notes || null,
      },
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d?.error?.message ?? "Submit failed"); return; }
    onDone?.();
  }

  async function decline() {
    setDeclining(true); setErr("");
    const res = await apiFetch("/api/installers/installer-decline", creds, {
      method: "POST",
      body: { quoteAssignmentId: assignment.id, reasonCodes: ["capacity_full"] },
    });
    setDeclining(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d?.error?.message ?? "Decline failed"); return; }
    onDone?.();
  }

  return (
    <>
      {/* Project Details */}
      <div style={{ background: T.bg, borderRadius: 12, padding: "16px", marginBottom: 20, border: `1px solid ${T.border}` }}>
        <Label>Project Details</Label>
        <InfoRow label="Location" value={regionLabel(qr.userLocationRegion)} />
        {spaceType && <InfoRow label="Space type" value={regionLabel(spaceType)} />}
        {area && <InfoRow label="Area" value={`${area} m²`} />}
        {purposePrimary && <InfoRow label="Primary goal" value={regionLabel(purposePrimary)} />}
        {estimatedCost && <InfoRow label="Budget estimate" value={fmtInr(estimatedCost)} color={T.accent} />}
        <InfoRow label="Requested" value={fmt(qr.requestedAt)} />
        {qr.notes && <div style={{ marginTop: 10, fontSize: 13, color: T.textMid, fontStyle: "italic" }}>"{qr.notes}"</div>}
      </div>

      {/* Quote form */}
      <Input label="Your quote (₹ INR)" type="number" value={amount} onChange={setAmount} placeholder="e.g. 45000" min="0" />
      <Input label="Estimated timeline (days)" type="number" value={days} onChange={setDays} placeholder="7" min="1" />
      <Textarea label="Scope of work (included)" value={scope} onChange={setScope} placeholder="Soil prep, container selection, planting, initial watering setup…" rows={3} />
      <Textarea label="Species you plan to install (comma-separated)" value={species} onChange={setSpecies} placeholder="Areca Palm, Snake Plant, Lemongrass…" rows={2} />
      <Textarea label="Additional notes" value={notes} onChange={setNotes} placeholder="Lead time, site visit required, etc." rows={2} />

      {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 16, fontFamily: T.sans }}>{err}</div>}

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="success" onClick={submit} disabled={loading || declining} style={{ flex: 1 }}>
          {loading ? "Submitting…" : "Submit Quote"}
        </Btn>
        <Btn variant="danger" onClick={decline} disabled={loading || declining}>
          {declining ? "…" : "Decline"}
        </Btn>
      </div>
    </>
  );
}

// ── Job action panel ───────────────────────────────────────────────────────
function JobPanel({ job, creds, onClose, onDone, openVerify }) {
  const [loading, setLoading] = useState(false);
  const [finalCost, setFinalCost] = useState(String(job.finalCostInr ?? job.estimatedCostInr ?? ""));
  const [notes, setNotes] = useState(job.jobNotes ?? "");
  const [err, setErr] = useState("");

  async function updateStatus(nextStatus) {
    setLoading(true); setErr("");
    const res = await apiFetch("/api/installers/installer-update-job", creds, {
      method: "POST",
      body: {
        installJobId: job.id,
        nextStatus,
        finalCostInr: nextStatus === "completed" && finalCost ? Number(finalCost) : null,
        jobNotes: notes || null,
      },
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d?.error?.message ?? "Update failed"); return; }
    onDone?.();
  }

  const sq = job.sourceQuote;
  const canStart = job.jobStatus === "scheduled";
  const canComplete = job.jobStatus === "started";

  return (
    <>
      <div style={{ background: T.bg, borderRadius: 12, padding: "16px", marginBottom: 20, border: `1px solid ${T.border}` }}>
        <Label>Job Details</Label>
        <InfoRow label="Status" value={<StatusChip status={job.jobStatus} />} />
        <InfoRow label="Scheduled" value={fmt(job.scheduledDate)} />
        {job.startedAt && <InfoRow label="Started" value={fmt(job.startedAt)} />}
        {sq && <InfoRow label="Quoted amount" value={fmtInr(sq.quoteAmountInr)} color={T.accent} />}
        {sq?.estimatedTimelineDays && <InfoRow label="Timeline" value={`${sq.estimatedTimelineDays} days`} />}
      </div>

      {sq?.proposedSpecies?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <Label>Proposed Species</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {sq.proposedSpecies.map((s, i) => (
              <span key={i} style={{ background: `${T.green}18`, border: `1px solid ${T.green}33`, color: T.green, borderRadius: 999, padding: "3px 10px", fontSize: 12 }}>🌿 {s}</span>
            ))}
          </div>
        </div>
      )}

      {(canStart || canComplete) && (
        <>
          {canComplete && (
            <Input label="Final cost (₹ INR)" type="number" value={finalCost} onChange={setFinalCost} placeholder="Actual installation cost" />
          )}
          <Textarea label="Job notes" value={notes} onChange={setNotes} placeholder="Site notes, issues encountered, next steps…" rows={2} />
        </>
      )}

      {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 14, fontFamily: T.sans }}>{err}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {canStart && (
          <Btn variant="primary" onClick={() => updateStatus("started")} disabled={loading} style={{ width: "100%" }}>
            {loading ? "Updating…" : "▶ Mark as Started"}
          </Btn>
        )}
        {canComplete && (
          <Btn variant="success" onClick={() => updateStatus("completed")} disabled={loading} style={{ width: "100%" }}>
            {loading ? "Updating…" : "✓ Mark as Completed"}
          </Btn>
        )}
        {job.jobStatus === "completed" && (
          <Btn variant="primary" onClick={openVerify} style={{ width: "100%" }}>
            📋 Submit As-Built Verification
          </Btn>
        )}
      </div>
    </>
  );
}

// ── As-built verification panel ────────────────────────────────────────────
const SOLUTION_TYPES = ["green_roof", "container_garden", "vertical_garden", "raised_planter", "shade_sail", "indoor_planters", "mixed"];
const PLANTER_TYPES = ["terracotta", "fibre", "fabric_bag", "concrete", "wood", "mixed", "none"];
const IRRIGATION_TYPES = ["drip", "manual", "sprinkler", "wick", "none"];
const SHADE_TYPES = ["shade_sail", "pergola", "trellis_climbers", "none"];

function VerifyPanel({ job, creds, onClose, onDone }) {
  const [solutionType, setSolutionType] = useState("container_garden");
  const [areaStr, setAreaStr] = useState("");
  const [planterType, setPlanterType] = useState("fibre");
  const [irrigationType, setIrrigationType] = useState("drip");
  const [shadeSolution, setShadeSolution] = useState("none");
  const [speciesInstalled, setSpeciesInstalled] = useState("");
  const [matchesRec, setMatchesRec] = useState(true);
  const [confidence, setConfidence] = useState("0.8");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!areaStr || Number(areaStr) <= 0) { setErr("Enter installed area in sqft"); return; }
    setLoading(true); setErr("");
    const speciesList = speciesInstalled.split(",").map(s => s.trim()).filter(Boolean);
    const res = await apiFetch("/api/installers/submit-verified-install", creds, {
      method: "POST",
      body: {
        installJobId: job.id,
        installedSolutionType: solutionType,
        installedAreaSqft: Number(areaStr),
        installedPlanterType: planterType,
        installedIrrigationType: irrigationType,
        installedShadeSolution: shadeSolution,
        installedSpeciesJson: JSON.stringify(speciesList),
        installedMaterialsJson: JSON.stringify([]),
        matchesRecommendedCandidate: matchesRec,
        mismatchReasonCodes: matchesRec ? [] : ["species_substitution"],
        installerConfidenceScore: Number(confidence) || 0.8,
        notes: notes || null,
        idempotencyKey: `verify-${job.id}-${Date.now()}`,
      },
    });
    setLoading(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d?.error?.message ?? "Submit failed"); return; }
    onDone?.();
  }

  function SelectField({ label, value, onChange, options }) {
    return (
      <div style={{ marginBottom: 16 }}>
        <Label>{label}</Label>
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ width: "100%", background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 10, padding: "11px 14px", color: T.textBright, fontSize: 14, fontFamily: T.sans, outline: "none", boxSizing: "border-box" }}>
          {options.map(o => <option key={o} value={o}>{regionLabel(o)}</option>)}
        </select>
      </div>
    );
  }

  return (
    <>
      <div style={{ background: `${T.green}10`, border: `1px solid ${T.green}33`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: T.green }}>
        This records what was actually installed. It feeds directly into our ML training data and cooling impact verification.
      </div>

      <SelectField label="Solution type" value={solutionType} onChange={setSolutionType} options={SOLUTION_TYPES} />
      <Input label="Installed area (sqft)" type="number" value={areaStr} onChange={setAreaStr} placeholder="e.g. 120" min="1" />
      <SelectField label="Planter type" value={planterType} onChange={setPlanterType} options={PLANTER_TYPES} />
      <SelectField label="Irrigation installed" value={irrigationType} onChange={setIrrigationType} options={IRRIGATION_TYPES} />
      <SelectField label="Shade solution" value={shadeSolution} onChange={setShadeSolution} options={SHADE_TYPES} />
      <Textarea label="Species installed (comma-separated)" value={speciesInstalled} onChange={setSpeciesInstalled} placeholder="Areca Palm, Snake Plant, Lemongrass, Vetiver…" rows={2} />

      <div style={{ marginBottom: 16 }}>
        <Label>Matches recommended plan?</Label>
        <div style={{ display: "flex", gap: 10 }}>
          {[true, false].map(v => (
            <button key={String(v)} onClick={() => setMatchesRec(v)}
              style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1.5px solid ${matchesRec === v ? (v ? T.green : T.orange) : T.border}`, background: matchesRec === v ? (v ? `${T.green}18` : `${T.orange}18`) : "transparent", color: matchesRec === v ? (v ? T.green : T.orange) : T.textDim, fontFamily: T.sans, fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
              {v ? "✓ Yes, followed plan" : "~ Modified plan"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Label>Installer confidence ({Math.round(Number(confidence) * 100)}%)</Label>
        <input type="range" min="0" max="1" step="0.05" value={confidence} onChange={e => setConfidence(e.target.value)}
          style={{ width: "100%", accentColor: T.accent }} />
      </div>

      <Textarea label="Notes" value={notes} onChange={setNotes} placeholder="Site conditions, substitutions made, plant health observations…" rows={2} />

      {err && <div style={{ color: T.red, fontSize: 13, marginBottom: 14 }}>{err}</div>}

      <Btn variant="success" onClick={submit} disabled={loading} style={{ width: "100%" }}>
        {loading ? "Submitting…" : "✓ Submit Verification"}
      </Btn>
    </>
  );
}

// ── Login screen ───────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [token, setToken] = useState("");
  const [installerId, setInstallerId] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function login() {
    if (!token.trim() || !installerId.trim()) { setErr("Both fields are required"); return; }
    setLoading(true); setErr("");
    const creds = { token: token.trim(), installerId: installerId.trim() };
    const res = await apiFetch("/api/installers/my-dashboard", creds);
    setLoading(false);
    if (res.status === 401 || res.status === 403 || res.status === 404) { setErr("Invalid credentials or installer not found"); return; }
    if (!res.ok) { setErr("Connection error — try again"); return; }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
    } catch {}
    onLogin(creds);
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontFamily: T.mono, fontSize: 11, letterSpacing: "4px", color: T.accent, marginBottom: 8 }}>HEATWISE</div>
          <h1 style={{ fontFamily: T.sans, fontSize: 26, fontWeight: 700, color: T.textBright, marginBottom: 8 }}>Installer Portal</h1>
          <p style={{ fontSize: 14, color: T.textDim, fontFamily: T.sans }}>Sign in with your installer credentials</p>
        </div>

        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 20, padding: 28 }}>
          <Input label="Installer ID" value={installerId} onChange={setInstallerId} placeholder="Your installer ID" />
          <Input label="Portal Token" type="password" value={token} onChange={setToken} placeholder="••••••••••••" />

          {err && (
            <div style={{ background: `${T.red}14`, border: `1px solid ${T.red}33`, borderRadius: 10, padding: "10px 14px", color: T.red, fontSize: 13, fontFamily: T.sans, marginBottom: 16 }}>
              {err}
            </div>
          )}

          <Btn variant="primary" onClick={login} disabled={loading} style={{ width: "100%", padding: "14px 0", fontSize: 15 }}>
            {loading ? "Signing in…" : "Sign In →"}
          </Btn>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: T.textDim, fontFamily: T.sans, marginTop: 24 }}>
          Need credentials? Contact <span style={{ color: T.accent }}>ops@heatwise.in</span>
        </p>
      </div>
    </div>
  );
}

// ── Pending assignments tab ────────────────────────────────────────────────
function PendingTab({ assignments, creds, onRefresh }) {
  const [selected, setSelected] = useState(null);

  function handleDone() {
    setSelected(null);
    onRefresh();
  }

  if (!assignments.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📭</div>
        <div style={{ color: T.textDim, fontSize: 14, fontFamily: T.sans }}>No pending quote requests</div>
        <div style={{ color: T.textDim, fontSize: 13, fontFamily: T.sans, marginTop: 6 }}>New jobs will appear here</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {assignments.map(a => {
          const qr = a.quoteRequest;
          const ps = qr.projectSnapshot ?? {};
          const spaceType = ps?.project?.space_type ?? ps?.space_type ?? null;
          const area = ps?.project?.area_m2 ?? null;
          const budget = qr.candidateSnapshot?.candidate?.estimatedInstallCostInr ?? null;
          return (
            <Card key={a.id} onClick={() => setSelected(a)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, marginBottom: 4 }}>NEW REQUEST · {fmt(a.assignedAt)}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.textBright, fontFamily: T.sans }}>{regionLabel(qr.userLocationRegion)}</div>
                </div>
                <StatusChip status="invited" />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {spaceType && <span style={{ background: `${T.accent}18`, color: T.accent, border: `1px solid ${T.accent}33`, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontFamily: T.mono }}>🏠 {regionLabel(spaceType)}</span>}
                {area && <span style={{ background: `${T.textDim}18`, color: T.textMid, border: `1px solid ${T.border}`, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontFamily: T.mono }}>{area} m²</span>}
                {budget && <span style={{ background: `${T.green}18`, color: T.green, border: `1px solid ${T.green}33`, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontFamily: T.mono }}>~{fmtInr(budget)}</span>}
              </div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6, color: T.accent, fontSize: 13, fontWeight: 600 }}>
                <span>View & Quote</span>
                <span>→</span>
              </div>
            </Card>
          );
        })}
      </div>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title="Quote Request">
        {selected && <QuotePanel assignment={selected} creds={creds} onClose={() => setSelected(null)} onDone={handleDone} />}
      </Sheet>
    </>
  );
}

// ── Active jobs tab ────────────────────────────────────────────────────────
function ActiveTab({ jobs, creds, onRefresh }) {
  const [selectedJob, setSelectedJob] = useState(null);
  const [verifyJob, setVerifyJob] = useState(null);

  function handleDone() {
    setSelectedJob(null);
    setVerifyJob(null);
    onRefresh();
  }

  if (!jobs.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🌿</div>
        <div style={{ color: T.textDim, fontSize: 14, fontFamily: T.sans }}>No active jobs</div>
        <div style={{ color: T.textDim, fontSize: 13, fontFamily: T.sans, marginTop: 6 }}>Accepted quotes will appear here</div>
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {jobs.map(j => {
          const sq = j.sourceQuote;
          return (
            <Card key={j.id} onClick={() => setSelectedJob(j)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, marginBottom: 4 }}>JOB · {fmt(j.scheduledDate ?? null)}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.textBright, fontFamily: T.sans }}>
                    {j.jobStatus === "started" ? "🔧 In Progress" : "📅 Scheduled"}
                  </div>
                </div>
                <StatusChip status={j.jobStatus} />
              </div>
              {sq && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: `${T.accent}18`, color: T.accent, border: `1px solid ${T.accent}33`, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontFamily: T.mono }}>{fmtInr(sq.quoteAmountInr)}</span>
                  <span style={{ background: `${T.textDim}18`, color: T.textMid, border: `1px solid ${T.border}`, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontFamily: T.mono }}>{sq.estimatedTimelineDays}d timeline</span>
                </div>
              )}
              <div style={{ marginTop: 14, fontSize: 13, color: T.accent, fontWeight: 600 }}>
                {j.jobStatus === "scheduled" ? "▶ Tap to Start Job →" : j.jobStatus === "started" ? "✓ Tap to Complete →" : "View Details →"}
              </div>
            </Card>
          );
        })}
      </div>

      <Sheet open={!!selectedJob && !verifyJob} onClose={() => setSelectedJob(null)} title="Install Job">
        {selectedJob && (
          <JobPanel
            job={selectedJob} creds={creds}
            onClose={() => setSelectedJob(null)} onDone={handleDone}
            openVerify={() => { setVerifyJob(selectedJob); setSelectedJob(null); }}
          />
        )}
      </Sheet>

      <Sheet open={!!verifyJob} onClose={() => setVerifyJob(null)} title="As-Built Verification">
        {verifyJob && <VerifyPanel job={verifyJob} creds={creds} onClose={() => setVerifyJob(null)} onDone={handleDone} />}
      </Sheet>
    </>
  );
}

// ── Completed jobs tab ─────────────────────────────────────────────────────
function DoneTab({ jobs }) {
  if (!jobs.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🏆</div>
        <div style={{ color: T.textDim, fontSize: 14, fontFamily: T.sans }}>No completed jobs yet</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {jobs.map(j => (
        <Card key={j.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: T.mono, fontSize: 9, color: T.textDim, marginBottom: 4 }}>{fmt(j.completedAt ?? j.cancelledAt)}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: T.textBright, fontFamily: T.sans }}>
                {j.jobStatus === "completed" ? "✓ Completed" : "✗ Cancelled"}
              </div>
              {j.finalCostInr && (
                <div style={{ fontSize: 13, color: T.textMid, marginTop: 4, fontFamily: T.sans }}>Final: {fmtInr(j.finalCostInr)}</div>
              )}
            </div>
            <StatusChip status={j.jobStatus} />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Main portal ────────────────────────────────────────────────────────────
export default function InstallerPortal() {
  const [creds, setCreds] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState("pending");
  const refreshing = useRef(false);

  // Try to restore session on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) setCreds(JSON.parse(stored));
    } catch {}
  }, []);

  const fetchDashboard = useCallback(async (c) => {
    if (!c || refreshing.current) return;
    refreshing.current = true;
    setLoading(true); setErr(null);
    const res = await apiFetch("/api/installers/my-dashboard", c);
    setLoading(false);
    refreshing.current = false;
    if (res.status === 401 || res.status === 403) {
      try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
      setCreds(null); return;
    }
    if (!res.ok) { setErr("Failed to load dashboard"); return; }
    const d = await res.json();
    setData(d);
  }, []);

  useEffect(() => {
    if (creds) fetchDashboard(creds);
  }, [creds, fetchDashboard]);

  function logout() {
    try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
    setCreds(null); setData(null);
  }

  if (!creds) return <LoginScreen onLogin={c => { setCreds(c); }} />;

  const installer = data?.installer;
  const tabs = [
    { id: "pending", label: "Pending", count: data?.stats?.pendingCount ?? 0 },
    { id: "active", label: "Active", count: data?.stats?.activeCount ?? 0 },
    { id: "done", label: "Done", count: null },
  ];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.textBright, fontFamily: T.sans }}>
      {/* Header */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div>
          <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: "3px", color: T.accent, marginBottom: 2 }}>HEATWISE INSTALLER</div>
          {installer ? (
            <div style={{ fontSize: 15, fontWeight: 700, color: T.textBright }}>{installer.installerName}</div>
          ) : (
            <div style={{ height: 18, width: 120, background: T.surfaceHigh, borderRadius: 6 }} />
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {installer && <StatusChip status={installer.verificationStatus === "verified" ? "verified" : installer.activeStatus} />}
          <button onClick={logout} style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.textDim, fontSize: 12, padding: "6px 12px", cursor: "pointer", fontFamily: T.mono }}>
            OUT
          </button>
        </div>
      </div>

      {/* Stats row */}
      {installer && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 1, background: T.border, borderBottom: `1px solid ${T.border}` }}>
          {[
            { label: "Pending", value: data.stats.pendingCount, color: T.orange },
            { label: "Active", value: data.stats.activeCount, color: T.green },
            { label: "Total Done", value: installer.jobsCompletedCount, color: T.accent },
            { label: "Rating", value: installer.averageRating ? `${installer.averageRating.toFixed(1)}★` : "—", color: T.gold },
          ].map(s => (
            <div key={s.label} style={{ background: T.surface, padding: "14px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.color, fontFamily: T.mono }}>{s.value}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 3, fontFamily: T.mono, letterSpacing: "0.06em" }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading / error */}
      {loading && !data && (
        <div style={{ padding: 40, textAlign: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(56,189,248,0.15)", borderTop: `3px solid ${T.accent}`, animation: "spin 0.9s linear infinite", margin: "0 auto 12px" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ color: T.textDim, fontSize: 13 }}>Loading dashboard…</div>
        </div>
      )}
      {err && (
        <div style={{ margin: 20, padding: "14px 18px", background: `${T.red}14`, border: `1px solid ${T.red}33`, borderRadius: 12, color: T.red, fontSize: 14 }}>
          {err} — <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => fetchDashboard(creds)}>retry</span>
        </div>
      )}

      {data && (
        <>
          {/* Tab bar */}
          <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, background: T.surface, position: "sticky", top: 56, zIndex: 9 }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ flex: 1, padding: "14px 8px", background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? T.accent : "transparent"}`, color: tab === t.id ? T.accent : T.textDim, fontFamily: T.mono, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "color 0.15s" }}>
                {t.label.toUpperCase()}
                {t.count != null && t.count > 0 && (
                  <span style={{ background: tab === t.id ? T.accent : T.textDim, color: T.bg, borderRadius: 999, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700 }}>{t.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: "20px 16px", maxWidth: 640, margin: "0 auto" }}>
            {/* Refresh button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button onClick={() => fetchDashboard(creds)}
                style={{ background: "none", border: `1px solid ${T.border}`, borderRadius: 8, color: T.textDim, fontSize: 11, padding: "5px 12px", cursor: "pointer", fontFamily: T.mono, letterSpacing: "0.05em" }}>
                {loading ? "…" : "↻ REFRESH"}
              </button>
            </div>

            {tab === "pending" && <PendingTab assignments={data.pendingAssignments} creds={creds} onRefresh={() => fetchDashboard(creds)} />}
            {tab === "active" && <ActiveTab jobs={data.activeJobs} creds={creds} onRefresh={() => fetchDashboard(creds)} />}
            {tab === "done" && <DoneTab jobs={data.completedJobs} />}
          </div>
        </>
      )}
    </div>
  );
}

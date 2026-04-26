# HeatWise trust, compliance & governance controls

Schemas, validation, and CSV exports for **consent**, **policy flags**, **retention posture**, and **governance reviews**—aligned with reporting, verified outcomes, integrations, commercial data, and platform hardening (audit / structured errors).

## Why this matters

Trust products need **explicit consent**, **traceable risk flags**, **documented retention**, and **human review queues**. v1 provides data models and ops APIs so legal, security, and product can grow policies without rewriting core recommendation or installer flows.

## Consent vs telemetry vs operational sharing

- **Consent** (`UserConsentRecord`) — user-facing **choices** per scope (media, telemetry use, installer sharing, follow-ups, analytics). Distinct from raw telemetry ingestion, which may still be governed by policy + consent together.
- **Telemetry** — behavioral signals (existing sessions/events); consent scopes describe *whether* those flows are allowed for that user.
- **Operational sharing** — e.g. installer quote flows; `installer_sharing` consent aligns with partner/commercial layers.

## Policy flag philosophy

`GovernancePolicyFlag` is a **durable workflow object**: type (risk, missing evidence, low confidence, pricing jump, installer mismatch, needs review), **severity**, **status**, and links to `entity_*`, `userId`, `projectId`. It complements append-only `PlatformAuditEvent` (hardening): flags are **actionable** until resolved.

## Retention & review philosophy

- **Retention** — `DataRetentionCategoryPolicy` rows summarize **TTL / archive / hard-delete** intent per major category (user, media, telemetry, commercial, verified outcomes, integrations, audit, governance). Not automatic deletion in v1; values support **DPA schedules** and engineering roadmaps.
- **Reviews** — `GovernanceReviewRecord` queues **human decisions** on high-risk dossiers, disputes, DSARs, escalations, and exceptions.

## v1 limits

- No automatic purge jobs or jurisdiction-specific legal engines.
- Consent APIs are **ops/admin** gated like other internal routes; end-user UI wiring is separate.
- Flags and reviews rely on **correct entity references** from callers.

## Layout

| Path | Role |
|------|------|
| `schemas/*.json` | Draft 2020-12 |
| `validators/*.py` | consent, policy flag, retention |
| `mappers/*.py` | CSV flattening |
| `exporters/*.py` | JSONL → CSV |

From `heatwise/platform`:

```bash
pip install -r governance_controls/requirements-dev.txt
PYTHONPATH=. pytest governance_controls/tests/test_governance_controls.py -v
```

## HTTP API (ops/admin)

- `GET|POST /api/governance/consent`
- `GET|POST|PATCH /api/governance/policy-flags`
- `GET|POST /api/governance/retention-summary`
- `GET|POST|PATCH /api/governance/review-summary`

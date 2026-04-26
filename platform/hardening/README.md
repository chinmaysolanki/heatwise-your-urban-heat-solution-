# HeatWise platform hardening & production readiness

Contracts and tooling for **structured errors**, **idempotent writes**, **audit trails**, and **subsystem readiness**—designed to integrate incrementally with existing Next.js APIs without rewriting handlers.

## Why hardening matters

Production incidents usually combine ambiguous client errors, duplicate submissions, and missing observability for sensitive actions. This layer adds **explicit envelopes** and **small services** so teams can adopt patterns gradually: normalize errors, guard double-posts, record audits, and scrape health signals before full SLO work.

## Structured error philosophy

APIs and services emit a **stable shape** (`code`, `message`, optional `severity`, `retriable`, `http_status_hint`, `subsystem`, `correlation_id`, `details`). The taxonomy in `lib/platformHardeningConstants.ts` and `schemas/error_contract_schema.json` keeps logs, dashboards, and clients aligned. Unknown codes are allowed but surface **warnings** in `error-preview` for drift detection.

## Idempotency boundaries

Critical writes (telemetry, quote actions, install/outcome submissions, revenue events) should accept a **client idempotency key** per `scope`. The `idempotencyService`:

1. Reserves `(scope, idempotencyKey)` or returns a **replay** of the stored response.
2. Detects **hash conflicts** when the same key is reused with a different request body fingerprint.
3. Uses `releaseIdempotencyReservation` on failure so retries can reclaim the key.

Wire-in pattern at an existing route: call `assertIdempotencyPolicy` → `reserveIdempotencyKey` → business logic → `completeIdempotencyRecord` (or `releaseIdempotencyReservation` on error).

## Audit trail design

`PlatformAuditEvent` rows are **append-only**: who did what (`actor_type`, optional `actor_id`), on which `subsystem`, against which `entity_*`, with `outcome` and a JSON `payload`. Use for privileged actions, data exports, and policy gates—not for high-volume debug noise.

## Readiness check philosophy

Readiness is **synthetic monitoring inside the app**: cheap DB counts / filesystem probes per subsystem (`recommendation_runtime`, `pricing`, `supply`, `installer_ops`, `reporting`, `retraining_registry`, `integrations`, `analytics`). Results aggregate to `healthy | degraded | unhealthy | unknown` for ops dashboards and deploy gates—not a replacement for external probes, but a consistent baseline.

## Layout

| Path | Role |
|------|------|
| `schemas/*.json` | JSON Schema contracts |
| `validators/*.py` | Validation for errors, audit, readiness rows |
| `mappers/*.py` | CSV-friendly flattening |
| `exporters/*.py` | JSONL → CSV for SIEM / spreadsheets |
| `tests/test_platform_hardening.py` | pytest |

## Commands

From `heatwise/platform`:

```bash
pip install -r hardening/requirements-dev.txt
PYTHONPATH=. pytest hardening/tests/test_platform_hardening.py -v
PYTHONPATH=. python -m hardening.exporters.export_audit_events \
  --input hardening/tests/fixtures/audit_events.jsonl --out-dir /tmp/hw_audit
PYTHONPATH=. python -m hardening.exporters.export_readiness_checks \
  --input hardening/tests/fixtures/readiness_checks.jsonl --out-dir /tmp/hw_ready
```

## HTTP API (ops/admin)

- `GET /api/platform/readiness` — aggregated checks
- `GET|POST /api/platform/audit-events` — list (GET) or append (POST)
- `POST /api/platform/error-preview` — validate/normalize error payloads

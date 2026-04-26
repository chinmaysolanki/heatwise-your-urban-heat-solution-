# HeatWise integrations readiness layer

Provider-agnostic contracts, validation, and export helpers for connecting HeatWise to CRMs, installer partners, notifications, payments, analytics sinks, and report delivery—without hard-coding a single vendor.

## Why this matters

External integrations fail in predictable ways: malformed payloads, unknown actors, broken entity references, ambiguous delivery state, and retries that corrupt history. This layer defines **stable envelopes** and **append-only audit events** so engineering can wire real connectors later with clear boundaries: validate → log → enqueue → deliver → reconcile.

## Outbound vs inbound

- **Outbound sync** — HeatWise pushes a **snapshot** of an entity (`target_system`, `entity_type`, `entity_id`, `payload_snapshot`) to a partner or internal queue. Status and retry metadata live on the `OutboundSync` row (mutable operational state), while **integration events** record what happened for audits.
- **Inbound webhooks** — Partners POST structured envelopes (`source_system`, `event_type`, `payload`, optional `external_event_id`). Validation status and linkage fields (`linkage_*`) tie the payload to core entities when present. **Duplicate protection** applies when `external_event_id` is supplied (composite uniqueness in the database).

## Delivery tracking philosophy

Not every message is “HTTP 200.” Reports, digests, push notifications, and partner file drops need a **delivery lifecycle** independent of business entities: `delivery_type`, `channel`, `target_ref`, `delivery_status`, attempts, and optional `outbound_sync_id` / `correlation_id` for tracing. This mirrors how observability and support teams reason about “did the user get the PDF?”

## Auditability and retry readiness

- **Integration events** are **append-only** (immutable log rows).
- **Outbound sync** rows carry **retry metadata** (`attempt_count`, `next_retry_at`, `error_code`, `error_detail`) for workers; validators reject obviously broken retry fields (e.g. stale `next_retry_at`, negative attempts).
- Python **JSON Schemas** under `schemas/` align with TypeScript allowlists in `heatwise/lib/integrationConstants.ts`—extend both when onboarding a new class of partner.

## Layout

| Path | Role |
|------|------|
| `schemas/*.json` | Draft 2020-12 contracts |
| `validators/*.py` | Structural + semantic checks |
| `mappers/*.py` | Flat rows for CSV / warehouse |
| `exporters/export_integration_events.py` | JSONL → `integration_events.csv` |
| `tests/test_integrations.py` | pytest coverage |

## Running tests and export

From `heatwise/platform` (repository root of the `integrations` package):

```bash
pip install -r integrations/requirements-dev.txt
PYTHONPATH=. pytest integrations/tests/test_integrations.py -v
PYTHONPATH=. python -m integrations.exporters.export_integration_events \
  --input integrations/tests/fixtures/integration_events.jsonl --out-dir /tmp/hw_int
```

## API surface (Next.js)

Ops/admin authenticated routes under `pages/api/integrations/`:

- `POST log-event` — append integration audit event
- `POST sync-preview` — size / shape preview for outbound payload (no persist)
- `POST webhook` — ingest inbound webhook (duplicate-aware)
- `GET|POST delivery-status` — read or create/update delivery rows

## Future path

When a real CRM or payment provider is chosen, add a **thin adapter** that maps vendor JSON into these envelopes, keep vendor IDs in `metadata`, and preserve **integration events** as the cross-system audit trail. No changes to core domain models are required for v1 readiness.

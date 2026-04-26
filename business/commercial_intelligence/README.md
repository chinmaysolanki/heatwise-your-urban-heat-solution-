# Commercial intelligence

## Why it matters

Operational metrics (latency, error rates, job status) do not answer whether the **business** is healthy. Commercial intelligence links **money**, **funnel progression**, and **installer economics** to the same project / quote / install graph the product already uses, so admin and finance views stay **auditable** and **exportable** without building a full general ledger.

## Operational vs business metrics

- **Operational**: API health, assignment throughput, verification SLAs — tells you if systems work.
- **Business**: revenue events, conversion rates, margin proxies, cohort revenue — tells you if the model scales.

## Revenue event philosophy

`revenue_event` rows are **append-only** business facts: what happened, when, with which foreign keys, and a **currency-safe** breakdown (gross, net, fees, tax, refunds). Corrections use new events (e.g. `refund_issued`), not silent edits. Status fields (`revenue_status`, `payment_status`) describe settlement, not replacement of history.

## Funnel and unit economics philosophy

Funnel milestones are **ordered stages** with timestamps; validators reject **time-incoherent** sequences (e.g. accepted before received when sorted by time). Unit economics snapshots are **aggregates over a window** with optional slices (region, project type, channel). They are **descriptive** KPIs for dashboards and exports, not statutory accounts.

## Cohort analysis purpose

Cohort views group projects by **creation week/month** (and optional dimensions) to compare **install penetration** and **revenue / repeat signals** over time — useful for GTM and retention experiments before a dedicated warehouse.

## v1 limitations and finance integration

This layer is **not** double-entry accounting, tax filing, or invoicing. It prepares **clean CSV / JSONL** feeds and stable IDs for a future ERP, data warehouse, or BI tool. Next steps: chart-of-accounts mapping, idempotent ingestion from payment providers, and reconciliation jobs against bank statements.

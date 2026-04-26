# Installer partner & field operations readiness

Contracts and exports for **partner-level** execution (organizations, coverage, capabilities, live field signals, SLA-style metrics). This sits alongside **installer-level** APIs under `pages/api/installers/*` (quotes, jobs, outcomes): those routes handle transactional work; this layer models **network readiness** and **operational scale-up**.

## Installer-level vs partner-level ops

- **Installer routes** — assign jobs, submit quotes, update `InstallerInstallJob`, verified installs: point-in-time workflow.
- **Partner operations** — org identity, **service areas**, **capability matrix**, **field ops status** (pause/overload/coverage gaps), and **SLA aggregates** derived from quotes/jobs/verifications for admin, supply, and pricing alignment.

## Capability & readiness philosophy

Capabilities are a **declared matrix** (project types, solution types, complexity bands, seasonal constraints, `service_readiness`). Matching is **conjunctive**: a request must fit every dimension the partner supports. Field ops status captures **live** constraints (regional readiness, overload) that may tighten routing without editing the static matrix.

## SLA interpretation

Metrics are **empirical medians/rates** over a window, sourced from existing tables:

- **Response time** — assignment `assignedAt` → quote `quotedAt`.
- **Quote turnaround** — quote request `requestedAt` → quote `quotedAt`.
- **Site visit completion** — share of scheduled jobs in-window with `startedAt` set (proxy when visit events are not modeled separately).
- **Install start delay** — quote `quotedAt` → job `startedAt`.
- **Verification delay** — job `completedAt` → verified install `verifiedAt`.

They are **not contractual SLAs** until legal/commercial teams adopt targets; the schema bounds impossible values for QA.

## Scale-up path

As the installer network grows, ops can onboard partners via `PartnerOperationsProfile`, tune `PartnerCapabilityMatrix`, monitor `PartnerFieldOpsStatus` aggregates, and track `PartnerSLAMetrics` windows—without changing core recommendation or quote handlers.

## Layout & commands

| Path | Role |
|------|------|
| `schemas/*.json` | JSON Schema (Draft 2020-12) |
| `validators/*.py` | Profile, capability, field-ops validation |
| `mappers/*.py` | CSV flattening |
| `exporters/*.py` | JSONL → CSV |

From `heatwise/ops`:

```bash
pip install -r partner_operations/requirements-dev.txt
PYTHONPATH=. pytest partner_operations/tests/test_partner_operations.py -v
PYTHONPATH=. python -m partner_operations.exporters.export_partner_operations \
  --input partner_operations/tests/fixtures/partner_ops.jsonl --out-dir /tmp/pops
PYTHONPATH=. python -m partner_operations.exporters.export_partner_sla_metrics \
  --input partner_operations/tests/fixtures/partner_sla.jsonl --out-dir /tmp/psla
```

## HTTP API (ops/admin)

- `GET|POST /api/partners/profile`
- `GET|POST /api/partners/capabilities` — optional `?match=1&projectType=&solutionType=&complexityBand=`
- `GET|POST /api/partners/field-status` — `?aggregate=1` for fleet summary
- `GET /api/partners/sla-summary` — `windowStart`, `windowEnd`, `recompute=1`

Prisma: `PartnerOperationsProfile`, `PartnerCapabilityMatrix`, `PartnerFieldOpsStatus`, `PartnerSLAMetrics` (all keyed by `installerId` → `InstallerProfile`).

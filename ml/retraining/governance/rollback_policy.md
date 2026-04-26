# Rollback policy — HeatWise ML models

## When to revert production to a previous registry version

1. **Performance regression** — Online or offline evaluation shows primary metric worse than the prior production model beyond agreed tolerance (see `promotion_gates.py` production checks) for **two consecutive** evaluation windows.
2. **Safety / feasibility failures** — Increase in flagged infeasible installs, structural incidents, or policy violations traced to model-driven recommendations.
3. **Data / feedback anomalies** — Sudden shift in telemetry mix, suspected data corruption, or broken feature pipeline affecting inference inputs.
4. **Operational failure** — Inference bundle fails to load, schema mismatch, or elevated error rate from the scoring service.

## Triggers (monitoring)

- **Regression:** Moving average of user satisfaction or measured cooling outcome drops > X% vs trailing 30-day baseline (set X with product).
- **Bad feedback:** Sustained negative explicit feedback rate on model-served sessions vs control.

## Artifact retention

- Keep **last N production models** (e.g. N=5) and **all** models promoted in the last 12 months.
- Archived models remain loadable for rollback; manifests must stay immutable.

## Process

1. Mark current production `retired_at` in registry; set status `archived`.
2. Promote previous known-good `staging` or `production` artifact to `production` (or deploy prior bundle from object store).
3. Record incident id in `notes` on both entries.

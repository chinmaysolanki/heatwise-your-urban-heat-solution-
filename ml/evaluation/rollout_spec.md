# Rollout specification — recommendation variants

## Variant definitions

| Variant | Meaning |
|---------|--------|
| `rules_only` | Deterministic rules + feasibility filters; no promoted ML bundle scoring (empty / missing registry index). |
| `hybrid_v1` | Rules + ML heads using production registry (`HEATWISE_REGISTRY_DIR`). |
| `ml_heavy_v1` | Higher ML weighting; v1 may share registry with hybrid until a separate bundle set exists. |
| `shadow_only` | Assignment arm used only for shadow computation; user always sees control. |

## Shadow evaluation lifecycle

1. Define experiment in `data/experiments.json` with `shadow_config.enabled` and traffic splits.
2. Assign users deterministically; in shadow phase **served_variant** is **control**, **assigned_variant** is the arm used for alternate computation.
3. For each qualifying request, run primary (served) and shadow (assigned) generators; compare with `shadow_comparator`; log to evaluations JSONL.
4. Analyze agreement and guardrails; advance gate when evidence is sufficient.

## Gate progression logic

Gates (`governance/rollout_gates.py`) encode:

- No **rollback triggers** (latency, errors, fallback, unsafe leakage, sharp engagement drops, harmful install signals).
- **Shadow** phase must show acceptable comparison and operational metrics before **ADVANCE** to small live percentages.
- **Subgroup** and **install** checks when data exists; otherwise **HOLD** with explicit reason.

Outcomes: `ADVANCE`, `HOLD`, `ROLLBACK`, `SHADOW_ONLY`.

## Rollback philosophy

Rollback is **prefer false positives** on alerts that threaten safety, latency SLA, or egregious engagement collapse. Prefer **rolling back traffic** before **disabling ML entirely** if rules-only is still healthy. All rollbacks should preserve **versioned logs** for postmortem.

## Minimum evidence before broad rollout

- Stable **shadow period** (calendar window + sample size N agreed by team).
- **Top-1 / top-3 agreement** or documented acceptable divergence with **no safety regression**.
- **p95 latency** and **fallback rate** within policy (`monitoring/alert_policy.md`).
- **No** unsafe candidate incidence.
- Engagement proxies **not materially worse** than control (pre-defined relative thresholds).
- If **install or outcome** data exists: treatment not materially worse than control on primary outcome metric.

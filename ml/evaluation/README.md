# HeatWise ML evaluation and rollout

Production-minded **shadow testing**, **experiment assignment**, **rollout gates**, and **monitoring** for recommendation variants (rules-only, hybrid, ML-heavy) without heavy external infra.

## Shadow testing

**Shadow mode** means the user always receives the **primary** (served) recommendation path, while the system **fully computes** an alternate path in the background, compares outputs, and logs structured diffs. That yields overlap, rank displacement, score deltas, and proxy deltas (cost, cooling, safety) **before** changing user-visible behavior.

See `shadow/shadow_runner.py` and `shadow/shadow_comparator.py`. Registry directory routing: an **empty** registry directory forces **rules-only** serving; the production `HEATWISE_REGISTRY_DIR` enables **hybrid / ML** when bundles exist.

## Assignment vs telemetry

- **Experiment assignment** (`experiments/assignment_policy.py`, `experimentAssignmentService.ts`) decides **which variant** a stable key maps to and whether the user is in **live**, **shadow**, or **disabled** mode. It is **configuration + hashing**, cheap and deterministic.
- **Recommendation telemetry** (sessions, impressions, feedback) captures **what happened** after generation. Exposure logs (`exposure_logger.py`) bridge the two: each generation should record experiment id, variants, versions, latency, and top candidate metadata for offline joins with product analytics.

## Rollout phases

Typical progression (see `rollout_spec.md` and `governance/rollout_gates.py`):

1. **rules_only** — baseline.
2. **shadow** — dual-run; no user-visible change to control arm.
3. **pct_5 → pct_25 → pct_50 → pct_100** — percentage live traffic to treatment, gated on metrics.

## Monitoring → gates

`monitoring/monitoring_metrics.py` defines aggregates (serving, engagement proxies, outcomes, distributions). `monitoring/anomaly_rules.py` and `governance/rollback_triggers.py` turn snapshots into **alerts** and **rollback** signals. **Gate decisions** (`ADVANCE` / `HOLD` / `ROLLBACK` / `SHADOW_ONLY`) consume those signals plus business checks (subgroups, install outcomes when available).

## Proxy metrics and limitations

Early-stage products often lack **install outcomes** and **post-install temperature** at volume. Engagement proxies (save, select, expand) are **noisy** and confounded by UI changes. Treat them as **guardrails**, not proof of cooling efficacy. Prefer **shadow agreement** (top-k overlap, safety deltas) before scaling live traffic.

## Data layout (v1)

- `data/experiments.json` — experiment definitions.
- `data/rollout_state.json` — coarse rollout pointer (optional).
- `data/exposures_<experiment_id>.jsonl` — exposure rows.
- `data/evaluations_<experiment_id>.jsonl` — per-request comparison summaries.
- `data/runtime_evaluations.jsonl` — Node runtime shadow evaluations (when enabled).

## Analysis CLIs

From `heatwise/ml` with `PYTHONPATH=.`:

```bash
python -m evaluation.analysis.compare_variants data/exposures_exp_xxx.jsonl -o /tmp/v.md
python -m evaluation.analysis.compare_rules_vs_ml data/evaluations_exp_xxx.jsonl
python -m evaluation.analysis.generate_eval_report --experiment-id exp_xxx -o /tmp/report.md
```

## Plug-in to the runtime API

1. **GET/POST** `/api/recommendations/assignment` — resolve assignment for a stable key and context.
2. **POST** `/api/recommendations/generate` — optional `evaluationContext` triggers registry selection and, when `evaluation_mode === "shadow"`, a **second** Python run for the shadow arm; the HTTP response remains **primary only**. Eval records append to `data/runtime_evaluations.jsonl`.
3. **GET** `/api/recommendations/rollout-status` — internal snapshot of experiments + rollout state.

Environment:

- `HEATWISE_EXPERIMENTS_PATH` — path to `experiments.json` (default: `ml/evaluation/data/experiments.json` under cwd).
- `HEATWISE_EVALUATION_DATA_DIR` — directory for JSONL + rollout file.
- `HEATWISE_RULES_ONLY_REGISTRY_DIR` — empty or minimal registry for rules-only (default: `ml/evaluation/data/empty_registry`).
- `HEATWISE_ENABLE_SHADOW_EVAL` — set to `1` to allow shadow dual-run from `generate` (safety: off by default).

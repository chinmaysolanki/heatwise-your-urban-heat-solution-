# HeatWise evaluation alert policy (v1)

Central place for default thresholds used by `anomaly_rules.py` and operational review. Tune per environment; store overrides in `rollout_state.json` or env if needed.

## Serving

| Rule | Default | Notes |
|------|---------|--------|
| `p95_latency_ms_max` | 2500 | Above this → investigate orchestrator / model load |
| `fallback_rate_max` | 0.15 | Sudden spike vs trailing 7d median → page on-call |
| `error_rate_max` | 0.02 | 5xx or unhandled exceptions in recommendation path |
| `shadow_compute_failure_rate_max` | 0.05 | Shadow path must not destabilize primary |

## Quality proxies

| Rule | Default | Notes |
|------|---------|--------|
| `select_drop_fraction` | 0.35 | Alert if current select_rate < baseline × (1 − 0.35) |
| `save_drop_fraction` | 0.30 | Same pattern for save_rate |
| `psi_alert` | 0.25 | PSI on binned top-1 blended scores vs baseline window |

## Safety

| Rule | Default | Notes |
|------|---------|--------|
| `unsafe_max` | 0 | Any unsafe candidate served → critical |

## Distribution / cohort

| Rule | Default | Notes |
|------|---------|--------|
| `mix_shift_max` | 0.20 | L1 distance on project_type mix vs baseline |
| `climate_mix_shift_max` | 0.20 | Same for climate_zone |

## Escalation

- **critical**: auto-rollback recommendation (see `rollback_triggers.py`) if wired; else page.
- **high**: hold rollout gate advancement.
- **medium**: require human sign-off before next phase.
- **low**: log and review in weekly eval report.

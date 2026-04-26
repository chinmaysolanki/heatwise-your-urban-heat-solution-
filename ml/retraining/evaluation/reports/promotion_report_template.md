# Promotion report — {{model_id}}

## Compared models

| Role | ID / version | Notes |
|------|----------------|-------|
| Candidate | {{candidate_version}} | {{experiment_name}} |
| Baseline | {{baseline_ref}} | optional metrics file |
| Production | {{production_ref}} | latest registry |

## Key metrics (validation)

```json
{{candidate_val_metrics_json}}
```

## Deltas vs baseline

```json
{{baseline_delta_json}}
```

## Deltas vs production (if any)

```json
{{production_delta_json}}
```

## Gate results

**Outcome:** `{{promotion_result}}`

### Reasons

{{gate_reasons}}

## Recommendation

{{recommendation_text}}

## Risk notes

{{risk_notes}}

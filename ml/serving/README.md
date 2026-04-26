# HeatWise runtime recommendation serving

Production **inference** path: deterministic **rules** → **hard filters** → **ML heads** (feasibility, heat, ranking from promoted bundles) → **weighted blend** → **rank** → **explanations**.  
Training lives in `ml/retraining/`; this package **only loads** `inference_bundle/` artifacts referenced from the filesystem registry.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ candidate_      │────▶│ candidate_filter     │────▶│ feasibility_    │
│ generator       │     │ (hard constraints)   │     │ heat_score_     │
│ (rules)         │     └──────────────────────┘     │ ranking_scorer  │
└─────────────────┘               │                 │ (sklearn/joblib)│
                                    │                 └────────┬────────┘
                                    ▼                          │
                          blocked candidates                   │
                                    │                          ▼
                                    └──────────────▶ candidate_rescorer
                                                     (blend weights)
                                                          │
                                                          ▼
                                              recommendation_orchestrator
                                                          │
                    ┌─────────────────────────────────────┴────────────────────────┐
                    ▼                                                              ▼
           explanation_builder                                          telemetryMeta
                    │                                                  (model + rules
                    ▼                                                   versions)
              ranked candidates + per-candidate explanations
```

## Runtime request / response contract

See `manifests/runtime_contract.json`. Minimal request:

```json
{
  "project": { "project_type": "rooftop", "budget_inr": 100000, "load_capacity_level": "medium" },
  "environment": { "water_availability": "moderate" },
  "preferences": { "purpose_primary": "cooling" },
  "maxCandidates": 8,
  "blendWeights": { "rules": 0.25, "feasibilityMl": 0.25, "heatMl": 0.25, "rankingMl": 0.25 },
  "rulesVersion": "hw-rules-v1.2",
  "registryDir": "/path/to/registry_store"
}
```

Response includes:

- `mode`: `full_ml` | `partial_ml` | `rules_only`
- `candidates[]`: `candidateId`, `rank`, `blocked`, `blockReasons`, `scores`, `candidatePayload`, `explanation`
- `telemetryMeta`: `generatorSource`, `rulesVersion`, `modelVersionFeasibility|Heat|Ranking`, `mlErrors`
- `runExplanation`: high-level counts and model version map

## Candidate scoring flow

1. **Rule templates** assign `rule_template_score` and full candidate feature columns used by ML.
2. **Hard filter** sets `blocked` + `blockReasons` (budget, load, water, pet safety, high-rise heuristics).
3. **ML** (if production bundles load): each head predicts one scalar per candidate; failures logged, fallback to rule prior for that head.
4. **Blend** (`orchestration/candidate_rescorer.py`): weighted sum of rule + three ML channels (normalized weights).
5. **Sort**: non-blocked first by `blended` descending, then blocked.

## Explanation payload

Per candidate (`explanation_builder.py`):

- `summaryBullets`: human-readable strings for UI
- `componentScores`: contribution breakdown after blend
- `finalBlendedScore`
- `mlHeadsUsed`: which heads returned a value

## Fallback behavior

- **No registry / no production models**: all bundles `null` → **rules_only** (blend uses rule prior for ML slots).
- **Partial load / predict errors**: **partial_ml**, `telemetryMeta.mlErrors` populated.
- **Node layer** (`lib/services/mlRecommendationService.ts`): if `python -m serving` fails, **TS rules-only fallback** (`lib/recommendation/rulesOnlyFallback.ts`) returns the same response shape with `generatorSource: live_rules`.

### Environment

| Variable | Purpose |
|----------|---------|
| `HEATWISE_REGISTRY_DIR` | Default registry root (contains `registry_index.json`) |
| `HEATWISE_SPECIES_CSV` | Optional `species_features.csv` for derived species columns |
| `HEATWISE_ML_CWD` | Working directory for `python -m serving` (default: `process.cwd()/ml` in Node) |
| `HEATWISE_ML_PYTHON` | Python binary (default `python3`) |

## CLI (stdin / stdout JSON)

From `heatwise/ml`:

```bash
export HEATWISE_REGISTRY_DIR=/path/to/registry_store
echo '{"project":{"project_type":"rooftop","budget_inr":90000},"environment":{},"preferences":{}}' | python3 -m serving
```

## Integration with existing recommendation APIs

| Step | API / service |
|------|----------------|
| 1. Generate slate | `POST /api/recommendations/generate` → `mlRecommendationService` → Python `-m serving` |
| 2. Explain one card | `POST /api/recommendations/explain` → `recommendationExplanationService` |
| 3. Persist session + snapshots | Existing `POST /api/recommendations/create-session` — pass `telemetryMeta.modelVersion*`, `rulesVersion`, `generatorSource` from generate response into your session payload (`modelVersion`, `rulesVersion`, `generatorSource` on `CreateRecommendationSessionInput` if fields exist — align with `recommendationTelemetryTypes`) |

After `generate`, map each candidate’s `candidatePayload` + scores into `candidates[]` for `create-session` as you already do for synthetic/live pipelines.

## Tests

```bash
cd heatwise/ml && pip install -r serving/requirements.txt && pytest serving/tests/ -q
```

## Layout

```
ml/serving/
  README.md
  __init__.py
  __main__.py
  requirements.txt
  manifests/runtime_contract.json
  loaders/load_inference_bundle.py
  scoring/features_frame.py
  scoring/feasibility_scorer.py
  scoring/heat_score_scorer.py
  scoring/ranking_scorer.py
  orchestration/candidate_generator.py
  orchestration/candidate_filter.py
  orchestration/candidate_rescorer.py
  orchestration/recommendation_orchestrator.py
  orchestration/explanation_builder.py
  tests/
```

## Related

- `ml/retraining/packaging/export_inference_bundle.py` — bundle layout
- `ml/retraining/registry/model_registry.py` — `inference_manifest_path` for production models

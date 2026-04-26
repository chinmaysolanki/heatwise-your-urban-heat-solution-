# HeatWise hybrid training data builder (v1)

Production-minded **dataset assembly** only: merges synthetic bootstrap exports, live telemetry (via `ml/live_data` exporters), explicit feedback, and install outcomes into a **unified, auditable** format with provenance, confidence tiers, and row weights.

Model training is **out of scope** here; downstream trainers consume the CSVs below.

## Outputs (hybrid dataset tables)

Written to `--output-dir`:

| File | Task support | Contents |
|------|----------------|----------|
| **`hybrid_pointwise.csv`** | Pointwise scoring / regression / classification | Unified rows: features (synthetic + live columns as available) + `pointwise_relevance_score`, `pointwise_binary_relevant`, `outcome_success_proxy`, `row_weight`, `label_confidence_tier`, `data_source`, `leakage_group_id`, `record_id`. |
| **`hybrid_ranking_pairs.csv`** | Pairwise ranking (RankNet-style, etc.) | Preferred vs other candidate, `preference_label`, `pair_confidence_tier`, `row_weight`, session scope for live, provenance. |
| **`hybrid_outcome_rows.csv`** | Outcome prediction | Live install targets (satisfaction, temp change, survival) + synthetic pseudo-outcomes from `long_term_success_likelihood` (low weight). |
| **`hybrid_manifest.json`** | Ops / audit | Row counts, policy versions, warnings (e.g. synthetic/live `project_id` collisions). |
| **`_live_training_cache/`** | Cache | Default directory for `export_training_dataset` outputs when `--live-feedback-csv-dir` is set (override with `--live-training-dir`). |

JSON Schema for core pointwise metadata: `schemas/hybrid_training_schema.json`.

## Row weighting policy

Implemented in `build_hybrid_dataset.py` from **`weighting_strategy.md`**:

- **Base weights** by `label_confidence_tier` (synthetic lowest, post-install highest).
- **Multipliers:** measured install fields boost post-install rows; implicit rows with **no** logged feedback are down-weighted.
- **Pairwise:** geometric mean of endpoint pointwise weights, ×0.85 for implicit-only pairs.
- **Clip:** final weights in **[0.05, 5.0]**.

## Confidence scoring policy

Four tiers (ordinal). Definitions and edge cases are in **`label_policy.md`**.

| Tier | Typical source |
|------|----------------|
| `synthetic_heuristic` | Bootstrap generator labels |
| `implicit_feedback_derived` | Views, impressions, expand, compare, … |
| `explicit_feedback_derived` | Select, save, thumbs, unsave |
| `post_install_validated` | Completed install with matching `selected_candidate_snapshot_id` |

## Usage

From repo root (with `pandas` installed; live path needs `ml/live_data` dependencies for training export):

```bash
cd heatwise/ml/hybrid_data

# Bootstrap processed/ must contain joined_training_table.csv (+ ranking_pairs.csv for synthetic pairs)
# Live folder: CSVs from ml/live_data/export_feedback_dataset.py (sessions, snapshots, events, outcomes)

python build_hybrid_dataset.py \
  --synthetic-processed-dir ../data/bootstrap/outputs/processed \
  --live-feedback-csv-dir /path/to/live/csv \
  --output-dir ./out/hybrid_run_001 \
  --rebuild-live-training

# Optional: leakage control — CSV columns: leakage_group_id (or project_id), split
python build_hybrid_dataset.py \
  --synthetic-processed-dir ../data/bootstrap/outputs/processed \
  --output-dir ./out/train_only \
  --split-manifest ./splits/manifest.csv \
  --split-filter train
```

## Dedupe and leakage

- **Pointwise:** `record_id` SHA prefix from `(data_source, leakage_group_id, candidate_key, recommendation_session_id)`; duplicate `record_id` rows dropped.
- **Pairs:** dedupe on `(data_source, project_id, preferred_candidate_id, other_candidate_id, recommendation_session_id)`.
- **Outcomes:** `outcome_record_id` deduped.
- **Leakage:** Train/val/test via manifest on **`leakage_group_id`** (defaults to `project_id`, or session when project missing for live). Do not split arbitrary rows without a group key.
- **Collision:** If the same `project_id` appears in synthetic and live, a warning is recorded in `hybrid_manifest.json` (synthetic IDs are normally `PRJ-*`).

## Sample assembled rows (illustrative)

**Pointwise (columns subset):**

| record_id | data_source | label_confidence_tier | leakage_group_id | candidate_key | row_weight | pointwise_relevance_score |
|-----------|-------------|------------------------|------------------|---------------|------------|---------------------------|
| `a1f2…` | synthetic_bootstrap | synthetic_heuristic | PRJ-000042-000001 | PRJ-000042-000001-C00 | 0.35 | 1.0 |
| `9c3e…` | live_telemetry | post_install_validated | proj_usr_12 | snap_01HZX… | 2.48 | 0.92 |

**Pairwise:**

| data_source | pair_confidence_tier | preferred_candidate_id | other_candidate_id | row_weight |
|-------------|----------------------|-------------------------|--------------------|------------|
| synthetic_bootstrap | synthetic_heuristic | …-C00 | …-C01 | 0.35 |
| live_telemetry | explicit_feedback_derived | cand_hi | cand_lo | 1.02 |

**Outcome:**

| data_source | label_confidence_tier | target_user_satisfaction | target_temp_change_c | row_weight |
|-------------|------------------------|--------------------------|----------------------|------------|
| live_telemetry | post_install_validated | 0.88 | -2.1 | 2.48 |
| synthetic_bootstrap | synthetic_heuristic | — | — | 0.21 |

## How this sets up v2 retraining

1. **Single contract:** Trainers read three tables + manifest; no ad-hoc joins across raw synthetic vs raw telemetry.
2. **Weighted objectives:** Pointwise / pairwise / outcome heads use `row_weight` and optional tier stratification.
3. **Calibration loop:** Compare implicit vs explicit vs install strata on a **held-out explicit + install** slice; adjust bases in `weighting_strategy.md` and bump `weighting_policy_version`.
4. **Audit trail:** `label_policy_version` + `weighting_policy_version` on every row tie back to markdown policy files.

## Related docs

- `label_policy.md` — tier rules, pairwise tiering, dedupe, leakage.
- `weighting_strategy.md` — numeric weights and multipliers.
- `../live_data/README.md` — telemetry → CSV → live training exports.

## Tests

```bash
pip install -r requirements-dev.txt
pytest tests/
```

## Directory layout

```
ml/hybrid_data/
  README.md
  label_policy.md
  weighting_strategy.md
  build_hybrid_dataset.py
  requirements.txt
  requirements-dev.txt
  schemas/
    hybrid_training_schema.json
  tests/
    conftest.py
    test_hybrid_builder.py
```

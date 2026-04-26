# HeatWise offline retraining — technical spec (v1)

## End-to-end flow

1. **Hybrid snapshot** — `ml/hybrid_data` produces `hybrid_pointwise.csv`, `hybrid_ranking_pairs.csv`, optional `hybrid_outcome_rows.csv`, and `hybrid_manifest.json` with a stable `snapshot_id`.
2. **Load & filter** — `run_retraining.py` loads the snapshot, optionally filters rows by provenance (`synthetic`, `live_implicit`, `live_explicit`, `post_install_validated`, `all`).
3. **Split** — `split_manager.split_by_group` assigns **entire** `leakage_group_id` (or `project_id`) to train / val / test so no candidate from the same site appears in multiple splits.
4. **Features & targets** — `feature_builder` intersects the frame with `ml/training/feature_registry.py` columns, joins species-derived fields via `training/preprocess.add_species_primary_features`, and writes `feature_manifest.json`. `target_builder` resolves targets with hybrid fallbacks (e.g. `pointwise_relevance_score` for heat when `heat_mitigation_score` is absent).
5. **Train** — Task-specific sklearn pipelines (`HistGradientBoostingRegressor` for regression; pairwise `LogisticRegression` on feature diffs + listwise HGBR for ranking).
6. **Evaluate** — Per-task metrics (MAE/RMSE/R² + buckets/subgroups; listwise NDCG/MRR/top-1 + pairwise accuracy/AUC when pairs exist).
7. **Compare** — Optional baseline metrics JSON; latest production metrics from the registry.
8. **Gates** — `governance/promotion_gates.py` → `PASS` | `PASS_TO_STAGING_ONLY` | `REJECT`.
9. **Register** — Append entry to `registry_index.json`; artifacts under `registry_dir/artifacts/{model_id}/`.
10. **Bundle** — `packaging/export_inference_bundle.py` writes `inference_bundle/` for runtime loading (joblib + manifests).
11. **Promote (optional)** — `--promote-if-passed` updates status to `staging` or `production`, retires prior production for that task.

## What counts as a training snapshot

- A **directory** containing at least `hybrid_pointwise.csv` (and, for ranking quality, `hybrid_ranking_pairs.csv`).
- The identifier `--train-snapshot-id` (or `hybrid_manifest.json` / folder name) is stored on every registry entry as `training_snapshot_id` for audit and rollback.

## Source weighting

- Hybrid rows may include `row_weight`. With `--use-sample-weights`, regression passes `sample_weight` to the tree model’s fit step. Pairwise logistic is unweighted in v1 (extension point).

## Safety vs online learning

- **Offline only:** no model updates from live traffic in this phase.
- **Immutable snapshots:** training reads a frozen CSV bundle; fixes require a new snapshot id.
- **Gates + staging:** low post-install volume forces `PASS_TO_STAGING_ONLY` before full production (configurable threshold).
- **Registry lineage:** `parent_model_id` reserved for future fine-tuning chains; artifacts and manifests enable reproducible rollback (see `governance/rollback_policy.md`).

# HeatWise offline retraining & model registry (v1)

Production-minded **offline** loop: train from hybrid data, evaluate, compare to baselines/registry, gate promotion, and export **inference bundles** for the runtime recommendation service. This does **not** perform online learning.

**Aligns with** `ml/training/` (feature registry, preprocess, baseline sklearn patterns) — retraining orchestrates those contracts at experiment scale.

## Purpose

- Train **feasibility**, **heat_score**, and **ranking** models from `ml/hybrid_data` outputs.
- Keep **project-level splits** (no cross-split candidate leakage).
- Record **artifacts, metrics, manifests** in a **filesystem registry**.
- Enforce **promotion gates** before staging/production.
- Emit a **runtime-loadable bundle** (`model.joblib` + JSON manifests) without importing training scripts.

## Supported tasks

| Task | Target (primary) | Model (v1) |
|------|-------------------|------------|
| `feasibility` | `feasibility_score` | sklearn `Pipeline` → HGBR |
| `heat_score` | `heat_mitigation_score` or hybrid fallbacks | same as feasibility |
| `ranking` | `best_candidate` / `pointwise_binary_relevant` (listwise) + pairwise prefs | HGBR listwise + optional pairwise logistic |

## Required inputs

- **Dataset directory** with `hybrid_pointwise.csv` (from `ml/hybrid_data/build_hybrid_dataset.py`).
- Optional: `hybrid_ranking_pairs.csv`, `hybrid_outcome_rows.csv`, `hybrid_manifest.json`.
- Optional: `species_features.csv` (bootstrap export) via `--species-csv` for species-derived columns.
- Optional: **baseline** metrics JSON (`--baseline-metrics`) shaped like `ml/training/baselines` outputs or retraining `metrics.json`.

## Outputs

Per task, under `--output-dir / {experiment-name} / {task}/`:

- `training_report.md` — filled from `evaluation/reports/training_report_template.md`
- `promotion_report.md` — from `promotion_report_template.md`

Under `--registry-dir`:

- `registry_index.json` — all model entries
- `artifacts/{model_id}/` — `model.joblib`, `model_pairwise.joblib` (ranking, optional), `feature_manifest.json`, `metrics.json`, `inference_bundle/` (manifest + copies)

## Registry lifecycle

Statuses: `candidate` → `staging` | `production` | `archived` | `failed`.

- New runs append as **`candidate`**.
- With **`--promote-if-passed`**: gates **REJECT** → remain candidate (still recorded); **PASS_TO_STAGING_ONLY** → `staging`; **PASS** → `production` (previous production for that **task** is **archived**).

## Promotion workflow

1. Run training without promote to inspect reports.
2. Re-run with `--baseline-metrics` and `--promote-if-passed` when satisfied.
3. Deploy the **`inference_bundle/`** directory to the scoring service (see below).

## CLI examples

From `heatwise/ml` (install: `pip install -r retraining/requirements-dev.txt`):

```bash
# Single task, no promotion
python retraining/run_retraining.py \
  --task feasibility \
  --dataset-path ../hybrid_data/out/run_001 \
  --registry-dir ./registry_store \
  --output-dir ./retraining_runs \
  --experiment-name exp_2026_03_27 \
  --train-snapshot-id hw_2026_03_27_a \
  --candidate-model-type sklearn_hgbr_v1 \
  --source-filter all \
  --species-csv ../data/bootstrap/outputs/processed/species_features.csv

# All tasks + baseline compare + promote if gates pass
python retraining/run_retraining.py \
  --task all \
  --dataset-path ../hybrid_data/out/run_001 \
  --registry-dir ./registry_store \
  --output-dir ./retraining_runs \
  --experiment-name full_run \
  --baseline-metrics ./baselines/feasibility_metrics.json \
  --promote-if-passed \
  --use-sample-weights \
  --notes "Weekly retrain after telemetry export"
```

## Runtime consumption (recommendation service)

1. Copy **`inference_bundle/`** (or sync from artifact store).
2. Read **`inference_manifest.json`** for file names and task.
3. Load **`model.joblib`** with **joblib** (same sklearn version major as training).
4. Build input rows using **`feature_manifest.json`** (`feature_names`, groups, dtypes).
5. For ranking pairwise mode (optional), load **`model_pairwise.joblib`** and apply the same diff-feature construction as training (`pipelines/ranking_features.py`).

No Python import of `run_retraining.py` is required at runtime.

## Limitations (v1)

- Filesystem registry only (no cloud object store).
- Ranking pairwise head skipped when pair count is small or join fails (see `metrics["pairwise_error"]`).
- Production gates use simple metric rules; calibrate thresholds per product KPIs.
- Categorical vocabulary is embedded in sklearn’s fitted `OneHotEncoder` inside the pipeline (not exported separately except via joblib).

## Tests

```bash
cd heatwise/ml && pytest retraining/tests/ -q
```

## Directory layout

```
ml/retraining/
  README.md
  retraining_spec.md
  run_retraining.py
  requirements.txt
  requirements-dev.txt
  pipelines/
    train_feasibility.py
    train_heat_score.py
    train_ranker.py
    ranking_features.py
  data/
    load_hybrid_dataset.py
    feature_builder.py
    target_builder.py
    split_manager.py
  evaluation/
    evaluate_feasibility.py
    evaluate_heat_score.py
    evaluate_ranker.py
    compare_to_baseline.py
    compare_to_registry_model.py
    reports/
      training_report_template.md
      promotion_report_template.md
  registry/
    model_registry.py
    registry_schema.json
    artifact_store.py
    versioning.py
  packaging/
    export_inference_bundle.py
    inference_manifest_schema.json
  governance/
    promotion_gates.py
    rollback_policy.md
    data_snapshot_policy.md
  tests/
    conftest.py
    test_retraining_pipeline.py
    test_registry.py
    test_promotion_gates.py
```

## Sample `registry_index.json` entry (abbreviated)

```json
{
  "models": [
    {
      "model_id": "feasibility_v2026_03_27_001_smoke",
      "model_name": "heatwise_feasibility",
      "task": "feasibility",
      "version": "feasibility_v2026_03_27_001",
      "status": "candidate",
      "trained_at": "2026-03-27T12:00:00+00:00",
      "training_snapshot_id": "test_snap",
      "feature_manifest_path": "/path/registry_store/artifacts/.../feature_manifest.json",
      "metrics_summary_path": "/path/registry_store/artifacts/.../metrics.json",
      "artifact_paths": {
        "model.joblib": "/path/.../model.joblib",
        "feature_manifest.json": "/path/.../feature_manifest.json",
        "metrics.json": "/path/.../metrics.json"
      },
      "training_code_version": "1.0.0",
      "candidate_model_type": "sklearn_hgbr_v1",
      "experiment_name": "smoke"
    }
  ]
}
```

## Sample training report sections

- **Run metadata** — experiment, snapshot, model type, code version  
- **Dataset** — train/val/test counts, group column, source mix  
- **Target & features** — target column, dropped registry columns  
- **Metrics** — val/test MAE, RMSE, R² (or listwise NDCG/MRR for ranking)  
- **Artifacts** — absolute paths to model and manifests  

## Sample promotion decision

```text
Outcome: PASS_TO_STAGING_ONLY
Reasons:
- post_install_rows_0_below_production_threshold_50
Recommendation: Promote to staging only until post-install volume threshold met.
```

(See `promotion_report.md` per run for full deltas vs baseline/production.)

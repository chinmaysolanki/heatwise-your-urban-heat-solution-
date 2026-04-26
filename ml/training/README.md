# HeatWise ML training (v1 scaffolding)

Production-minded **spec + code skeleton** for the first recommendation models. **Offline retraining, registry, and promotion** live in [`../retraining/`](../retraining/) (filesystem registry, gated promotion, inference bundles). This folder stays focused on feature/target contracts and baseline trainers.

## Contents

| File / directory | Purpose |
|------------------|---------|
| `training_spec.md` | Full v1 training spec (tasks, features, preprocessing, metrics, synthetic→real). |
| `feature_registry.py` | Feature groups and per-task column lists (aligned with bootstrap `joined_training_table`). |
| `target_registry.py` | Target columns and semantics. |
| `preprocess.py` | Species join + simple imputation helpers; sklearn pipelines live in baselines. |
| `baselines/` | Runnable entrypoints that write `metrics.json` under `runs/`. |
| `evaluation/metrics.py` | MAE, RMSE, R², ROC-AUC, nDCG helper. |
| `evaluation/report_template.md` | Copy/paste template for run reports. |
| `requirements.txt` | `pandas`, `numpy`, `scikit-learn`. |

## Prerequisites

1. Generate data: `heatwise/ml/data/bootstrap/generate_synthetic_dataset.py` → `outputs/processed/splits/{train,val,test}/`.
2. Python env with dependencies:

```bash
cd heatwise/ml/training
pip install -r requirements.txt
```

3. **PYTHONPATH** must include `heatwise/ml` so `import training.*` resolves:

```bash
export PYTHONPATH="/abs/path/to/heatwise/ml"
```

## Baseline entrypoints

**Feasibility** (regression on `feasibility_score`):

```bash
export PYTHONPATH="$(pwd)/.."
python baselines/train_feasibility_baseline.py \
  --train-csv ../data/bootstrap/outputs/processed/splits/train/joined_training_table.csv \
  --val-csv ../data/bootstrap/outputs/processed/splits/val/joined_training_table.csv \
  --test-csv ../data/bootstrap/outputs/processed/splits/test/joined_training_table.csv \
  --species-csv ../data/bootstrap/outputs/raw/species_features.csv \
  --out-dir runs/feasibility_baseline
```

**Heat mitigation** — same flags, script `train_heat_score_baseline.py`.

**Ranking** (pairwise logistic on engineered pair features):

```bash
python baselines/train_ranking_baseline.py \
  --train-joined-csv ../data/bootstrap/outputs/processed/splits/train/joined_training_table.csv \
  --train-pairs-csv ../data/bootstrap/outputs/processed/splits/train/ranking_pairs.csv \
  --val-joined-csv ../data/bootstrap/outputs/processed/splits/val/joined_training_table.csv \
  --val-pairs-csv ../data/bootstrap/outputs/processed/splits/val/ranking_pairs.csv \
  --test-joined-csv ../data/bootstrap/outputs/processed/splits/test/joined_training_table.csv \
  --test-pairs-csv ../data/bootstrap/outputs/processed/splits/test/ranking_pairs.csv \
  --species-csv ../data/bootstrap/outputs/raw/species_features.csv \
  --out-dir runs/ranking_baseline
```

## Evaluation outputs to track

- **Per run:** `runs/<name>/metrics.json` (machine-readable).
- **Human summary:** fill `evaluation/report_template.md` with the same numbers + data version + git SHA.
- **Always log:** row counts, split manifest hash, `species_features` file hash, bootstrap generator version / `generation_rules.json` version field.

## Next steps (not in this folder)

- Serialize `Pipeline` with `sklearn` `joblib` for serving.
- Add real-label ETL and merge keys (`user_id`, `session_id`, `plan_id`).
- Replace pairwise logistic with listwise ranker when impression logs support slate-level training.

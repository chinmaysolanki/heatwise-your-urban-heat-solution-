# HeatWise v1 ML training specification

This document defines **what** we train first, **with which inputs**, **how we preprocess**, **which baselines to beat**, **how we evaluate**, and **how synthetic pretrain connects to real feedback**. It pairs with code under `heatwise/ml/training/`.

---

## 1. First three model tasks

| # | Task | Target column(s) | Primary use |
|---|------|------------------|-------------|
| 1 | **Feasibility scoring** | `feasibility_score` | Rank/filter plans by structural/ops plausibility before surfacing to users. |
| 2 | **Heat mitigation scoring** | `heat_mitigation_score` | Score expected cooling contribution of a proposed plan. |
| 3 | **Candidate ranking / selection** | Pairwise: `preference_label` in `ranking_pairs.csv`; listwise proxy: `best_candidate` | Re-order or select among 3–5 candidates per `project_id`. |

**Synthetic v1:** targets come from the bootstrap engine (heuristic).  
**Production:** replace or blend targets with measured outcomes and explicit user choices (see §7).

---

## 2. Input feature groups

Features are defined in `feature_registry.py` and must **exclude** all columns in `LABEL_LEAKAGE_COLUMNS` when training deployable scorers.

| Group | Role | Example columns |
|-------|------|-----------------|
| **Project structure** | Physical envelope | `project_type`, `area_sqft`, `load_capacity_level`, `railing_height_ft`, … |
| **Preferences** | Stated user/product intent | `budget_inr`, `purpose_primary`, `child_pet_safe_required`, … |
| **Environment** | Climate / exposure / water | `climate_zone`, `avg_summer_temp_c`, `water_availability`, `irrigation_possible`, … |
| **Candidate solution** | Proposed install recipe (not yet “scores”) | `recommendation_type`, `greenery_density`, `planter_type`, `irrigation_type`, `estimated_install_cost_inr`, … |
| **Species-derived** | Library join on `species_primary` | `species_primary_cooling_contribution`, `species_primary_water_demand_ord`, … |

**Join rule:** `preprocess.add_species_primary_features(joined, species_features.csv)` adds derived columns; missing species → imputed defaults in baseline pipelines.

---

## 3. Preprocessing strategy

| Topic | v1 rule |
|-------|---------|
| **Categorical** | `OneHotEncoder(handle_unknown="ignore")` fit on **train** only; unseen categories at inference map to all-zero OHE block. |
| **Numerical** | `SimpleImputer(strategy="median")` on train; same statistics for val/test. Optional `StandardScaler` inside the same train-fitted branch when moving to linear / neural models. |
| **Missing values** | Engine-generated data: rare NaNs unless `--with-missingness`. Real data: expect systematic missingness on optional site survey fields — keep imputers in the saved **inference bundle**. |
| **Train/val/test consistency** | Splits are **by `project_id`** only (bootstrap `outputs/processed/splits/`). Preprocessing objects are **fit on train** and **frozen** for val/test and serving. |
| **Pairwise ranking** | Baseline builds pairwise features: numeric `absdiff__*`, categorical `match__*` (1 if equal). Alternative (Phase 2): score difference of two pointwise models. |

---

## 4. Baseline model choices (v1)

| Task | Baseline | Rationale |
|------|----------|-----------|
| Feasibility | `HistGradientBoostingRegressor` in a sklearn `Pipeline` | Strong default on mixed types after OHE; handles moderate dimensionality; no torch dependency. |
| Heat mitigation | Same as feasibility | Shared preprocessing pattern; later multitask head can share trunk. |
| Ranking | `LogisticRegression` on pairwise features | Cheap, interpretable, stable; upgrade path to LambdaMART / XGBoost ranker / cross-encoder. |

**Not in v1:** heavy deep models, multitask transformers, or full Ray/Spark — add when data volume and serving constraints justify.

---

## 5. Evaluation metrics

| Task | Metrics | Notes |
|------|---------|--------|
| Feasibility / heat | MAE, RMSE, R² (per split) | R² can be noisy on small val splits; prefer MAE/RMSE for early decisions. |
| Ranking (pairwise) | Accuracy @ 0.5 threshold, ROC-AUC on `preference_label` | AUC reflects ranking quality on pairs; not identical to listwise NDCG. |
| Ranking (listwise, optional) | nDCG@K per project, top-1 accuracy vs `best_candidate` | Implement when moving from pairs to full slate metrics (`evaluation/metrics.py` has `ndcg_at_k`). |

**Calibration:** for production go/no-go, add reliability curves / ECE on held-out **real** acceptance data.

---

## 6. Code map (scaffolding only)

| Path | Purpose |
|------|---------|
| `feature_registry.py` | Column groupings + per-task feature lists |
| `target_registry.py` | Target metadata + production replacement notes |
| `preprocess.py` | Species join + impute helpers + preprocessing contract |
| `baselines/train_*_baseline.py` | Runnable sklearn entrypoints → `runs/*/metrics.json` |
| `evaluation/metrics.py` | Numpy metrics + `report_template.md` for human-readable runs |

---

## 7. Synthetic → real-world data

1. **Pretrain** on full synthetic `joined_training_table.csv` (+ pairs) to learn coarse structure → climate, budget, solution type interactions.
2. **Freeze or low-LR fine-tune** when first real labels arrive (accept/reject, install completed, temperature delta).
3. **Blending:** `loss = λ * L_synthetic + (1-λ) * L_real` only if real labels are aligned to the same target semantics; otherwise **train separate heads** or **distill** from synthetic teacher to student on real data only.
4. **Feedback loop:** log `project_id`, candidate IDs, position, impression counts; join to later outcomes; rebuild `ranking_pairs` from implicit feedback (skip-hard negatives, debias position).
5. **Species:** replace static `species_features.csv` with catalog versioning; track `species_catalog_version` in training manifests.

---

## 8. Feature list by model (canonical)

All three models use the **same** deployable feature vector in v1 (`FEASIBILITY_V1_FEATURES` = `HEAT_MITIGATION_V1_FEATURES` = `RANKING_V1_FEATURES`):  
project structure + preferences + environment + candidate solution + species-derived columns (see `feature_registry.py` for the explicit tuple).

**Ranking baseline** consumes the **pairwise transformation** of those features (not raw concatenation of two full vectors in v1).

---

## 9. Target definitions (summary)

| Task | Column | Type | Notes |
|------|--------|------|--------|
| Feasibility | `feasibility_score` | float [0,1] | Synthetic; later: checklist / engineer outcome |
| Heat mitigation | `heat_mitigation_score` | float [0,1] | Synthetic; later: metered or user-reported |
| Ranking | `preference_label` (pairs) | int 1 | Preferred beats other within project |
| Ranking (proxy) | `best_candidate` | int 0/1 | Top slate row; later: chosen plan |

See `target_registry.py` for `TargetSpec` including `production_replacement` strings.

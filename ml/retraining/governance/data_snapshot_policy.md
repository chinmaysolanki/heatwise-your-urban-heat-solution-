# Training data snapshot policy

## Immutable snapshot IDs

- Each hybrid dataset build used for training must have a **`training_snapshot_id`** (directory name or UUID) logged in `hybrid_manifest.json` and copied into every registry entry as `training_snapshot_id`.
- Snapshots are **read-only** after creation; fixes require a **new** snapshot id, not in-place edits.

## Source composition logging

- Registry entries store `source_mix_summary` (counts by `data_source` and `label_confidence_tier`) from `snapshot_source_mix()`.
- Promotion gates may require minimum counts for `post_install_validated` before full production promotion.

## Minimum data checks

- **Train/val/test** must each have a minimum number of **leakage groups** (projects/sessions), not just rows — enforced in `run_retraining.py` via split stats.
- Empty val/test for a task → **failed** run unless explicitly allowed for dry-run experiments.

## Reproducibility

- Store: `feature_manifest.json`, `metrics.json`, hyperparams, `training_code_version` (git sha or package version), and sklearn `model.pkl` (joblib).
- Same snapshot + same seed + same code version should reproduce metrics within floating-point noise.

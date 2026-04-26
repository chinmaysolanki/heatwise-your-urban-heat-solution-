# ML registry → serving bundles

## Retraining → bundle → registry → serving (happy path)

1. **Train / export:** Python code under `ml/retraining/` produces artifacts; `ml/retraining/packaging/export_inference_bundle.py` writes a directory with `inference_manifest.json`, `model.joblib`, and `feature_manifest.json`.
2. **Promote:** Copy or reference that bundle in your registry root and append/update `registry_index.json` so each `task` has a row with `status: "production"` and a valid `inference_manifest_path` (or artifact paths the loader understands).
3. **Serve:** The Next.js app invokes `generateRecommendationsRuntime`, which shells into `heatwise/ml` with `HEATWISE_REGISTRY_DIR` set; `load_production_bundles()` loads the latest production bundle per task for the Python ranker.

## Artifact layout

1. **Retraining / packaging** (see `ml/retraining/packaging/`) exports **inference bundles**: directories with `inference_manifest.json`, `model.joblib`, `feature_manifest.json` (optional `model_pairwise.joblib`).
2. **Registry** promotes models via `registry_index.json` at **`HEATWISE_REGISTRY_DIR`** (or `registryDir` on the generate request). Each entry includes `task`, `status` (`production`, …), paths to manifests or artifacts.
3. **Serving** (`python -m serving`) calls `load_production_bundles()` in `ml/serving/loaders/load_inference_bundle.py` to resolve latest **production** bundle per task (`feasibility`, `heat_score`, `ranking`).

## Runtime expectations

| Variable / field | Meaning |
|------------------|---------|
| `HEATWISE_REGISTRY_DIR` | Absolute path to registry root on the **app host** running Python (same machine or mounted volume as Next). |
| `registryDir` on generate | Overrides env for that request (e.g. experiments). |
| `HEATWISE_ML_CWD` | Working directory for `python -m serving` (default `heatwise/ml`). |
| `HEATWISE_ML_PYTHON` | Python executable (default `python3`). |

If `HEATWISE_REGISTRY_DIR` is unset or the index has no production rows, serving still runs but may behave as **rules-only / partial ML**; Node adds TS fallback errors in `telemetryMeta.mlErrors` when Python fails.

## Validate locally

From `heatwise/ml`:

```bash
HEATWISE_REGISTRY_DIR=/path/to/registry python3 scripts/validate_serving_bundles.py
# Fail CI if index exists but nothing loads:
HEATWISE_REGISTRY_DIR=/path/to/registry python3 scripts/validate_serving_bundles.py --strict
```

**Preflight JSON** (readiness + failure modes):

```bash
npm run ml:serving-readiness
HEATWISE_REGISTRY_DIR=/path/to/registry npm run ml:serving-readiness -- --strict
```

`diagnose_production_bundle_loading()` in `ml/serving/loaders/load_inference_bundle.py` reports `readiness`: `full` | `partial` | `none` | `no_index` and a `failure_modes` list (missing index, bad manifest path, corrupt joblib, etc.).

Pytest smoke (includes loading a **minimal real** bundle from an on-the-fly tmp dir). From repo root:

```bash
npm run ml:serving-smoke
```

This runs `ml/scripts/run_serving_smoke.sh`, which creates `ml/.venv` if needed, installs `pytest` + `joblib`, and executes the tests (avoids Homebrew PEP 668 conflicts).

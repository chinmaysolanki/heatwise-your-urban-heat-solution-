# HeatWise synthetic bootstrap — ML data pipeline

Production-style **synthetic** dataset builder for rooftop / terrace / balcony recommendation ML. Rows are **heuristic**, not logged user behavior—use for architecture bring-up, model prototyping, and CI; replace labels with real telemetry + horticulture QA before production.

## What gets generated

| Stage | Location | Contents |
|--------|-----------|----------|
| **Raw** | `outputs/raw/` | `projects.csv`, `candidates.csv`, `ranking_pairs.csv`, `species_features.csv` |
| **Samples** | `outputs/samples/` | Head rows of each raw file (quick inspection) |
| **Processed** | `outputs/processed/` | `project_features.csv`, `recommendation_labels.csv`, `ranking_pairs.csv`, `candidates.csv`, `joined_training_table.csv` |
| **Splits** | `outputs/processed/splits/{train,val,test}/` | Same logical tables filtered by `project_id` (no leakage) |
| **QA** | `validation_report.md` (repo root by default) | Counts, distributions, failed checks, warnings |

### Entity model

- **`project_id`** — one synthetic “site” / user space.
- **`candidate_id`** — one scored recommendation for that site.
- **3–5 candidates** per project (configurable); **`rank_position`** 1 = best.
- **`best_candidate`** — `1` on exactly the row with `rank_position == 1`, else `0`.
- **`ranking_pairs.csv`** — directed pairs `(preferred, other)` with `preference_label=1` for pairwise / RankNet-style training.

## CLI

From `heatwise/ml/data/bootstrap` (use a venv with `pandas`, `numpy`; dev tests need `pytest`):

```bash
# Default: full pipeline (raw → processed → splits → validation_report.md)
python generate_synthetic_dataset.py --rows 5000 --seed 42 --profile balanced

# Custom I/O
python generate_synthetic_dataset.py --rows 2000 --output-dir ./outputs --config-dir ./config

# Optional NaN injection (uses missing_rate + missing_columns from generation_rules.json)
python generate_synthetic_dataset.py --rows 1000 --with-missingness

# Candidate slate size
python generate_synthetic_dataset.py --rows 3000 --min-candidates 4 --max-candidates 5

# Merge extra JSON over generation_rules.json
python generate_synthetic_dataset.py --generation-rules ./my_overrides.json

# Legacy single wide CSV
python generate_synthetic_dataset.py --flat-only --rows 25000 --output-dir ./outputs

# Processed tables only (no splits)
python generate_synthetic_dataset.py --rows 1000 --no-splits

# Raw + QA only
python generate_synthetic_dataset.py --rows 500 --no-transforms
```

### Standalone transforms

```bash
python transforms/build_training_tables.py --raw-dir ./outputs/raw --processed-dir ./outputs/processed
python transforms/split_dataset.py --processed-dir ./outputs/processed --seed 42
```

## Configuration

| File | Role |
|------|------|
| `config/generation_rules.json` | Candidate counts, missingness, split ratios, sampling overrides, **validation thresholds** |
| `config/species_library.json` | Species records consumed by the engine (required; invalid JSON or schema → clear error) |

On startup the CLI calls `configure_bootstrap(config_dir)`, which:

1. Loads and validates `species_library.json`, then `set_species_library(...)`.
2. Merges `generation_rules.json` with embedded defaults (missing keys get safe defaults).
3. Returns a `GenerationConfig` for generation and splits.

## Extending the species library

1. Edit `config/species_library.json` (append objects to `"species"`).
2. Keep **unique** `key` values; enums must match those used in `synthetic_bootstrap/species.py` (`ClimateTag`, `SunPref`, `WaterDemand`, etc.).
3. Re-run generation; the engine reads only the JSON-backed library after `configure_bootstrap`.

## Using exports for training

- **Pointwise / multitask:** `processed/joined_training_table.csv` — project features repeated per candidate row; label columns on each row.
- **Listwise / LTR:** group by `project_id`, order by `rank_position`, use `overall_recommendation_score` or ranks as relevance.
- **Pairwise:** `ranking_pairs.csv` — each row states the preferred candidate for a pair within the same project.
- **Species sidecar:** join `species_features.csv` on `species_name` (or add `species_key` in a future export if you normalize names).

## Limitations

- Scores and costs are **synthetic heuristics**, not measured outcomes.
- Species suitability is **rule-based**, not a verified regional catalog.
- No temporal drift, supply chain, or installer variance—extend the engine if you need those effects.

## Tests

```bash
pip install -r requirements-dev.txt
pytest tests/ -q
```

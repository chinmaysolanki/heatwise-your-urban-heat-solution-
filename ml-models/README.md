# HeatWise ML models (standalone)

Training and experimentation for **tabular** species / multi-label models. This folder is **not** imported by the Next.js app, Prisma, or API routes.

## Layout

| Path | Purpose |
|------|---------|
| `data/` | CSV (or future Parquet) datasets exported for training |
| `notebooks/` | Exploratory notebooks |
| `scripts/` | Training and evaluation scripts |
| `models/` | Saved artifacts (`joblib`). `*.joblib` is listed in `ml-models/.gitignore` by default — remove that line if you want to commit small artifacts. |

## Setup

From the **repository root** or from **`heatwise/ml-models/`**:

```bash
cd heatwise/ml-models
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

## Train a baseline species (multi-label) model

1. Place a CSV under `data/`. Target columns should be **binary** (0/1) species indicators, named with a common prefix (default: `species_`).

2. Run:

```bash
cd heatwise/ml-models
source .venv/bin/activate
python scripts/train_species_model.py --data data/your_dataset.csv
```

### Useful flags

```text
--data PATH           CSV path (default: data/heatwise_species_sample.csv)
--target-prefix STR   Column prefix for labels (default: species_)
--test-size FLOAT     Holdout fraction (default: 0.2)
--random-state INT    Reproducibility (default: 42)
--output PATH         Saved model path (default: models/species_model.joblib)
--exclude-cols COLS   Comma-separated columns to drop from features (e.g. run_id,split)
```

### Example with the bundled sample

```bash
python scripts/train_species_model.py --data data/heatwise_species_sample.csv
```

## Dataset contract (expected columns)

- **Features**: numeric and/or categorical columns (everything that is not a species label and not excluded). Examples: climate signals, sun/wind, budget band, maintenance level, user gardening score, etc.
- **Targets**: one column per species, values **0 or 1**, names like `species_sedum_acre`, `species_lavandula`, … (prefix configurable).

Adjust `--target-prefix` if your export uses another naming scheme (e.g. `sp__`).

## Notes

- Export ranking/species datasets from the app **separately** (e.g. admin CSV) into `data/`; this workspace only **consumes** files.
- For production workflows, pin versions in a lockfile or Docker image; `requirements.txt` uses compatible ranges for local dev.

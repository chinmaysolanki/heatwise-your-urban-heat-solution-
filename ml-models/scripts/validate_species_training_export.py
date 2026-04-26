#!/usr/bin/env python3
"""
HeatWise — validate species multi-label training CSVs before training.

Aligns with heatwise/lib/ml/trainingExport.js feature set and leakage rules.

Exit codes:
  0 — no blocking errors (warnings may still print)
  1 — blocking validation errors (missing columns, leakage, invalid targets)
  2 — file not found / unreadable CSV
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

try:
    import pandas as pd
except ImportError:  # pragma: no cover
    print(
        "Missing pandas. From ml-models/: pip install -r requirements.txt",
        file=sys.stderr,
    )
    raise SystemExit(3)

# Keep in sync with heatwise/lib/ml/trainingExport.js
REQUIRED_FEATURE_COLUMNS: tuple[str, ...] = (
    "space_type",
    "area_sqm",
    "length_m",
    "width_m",
    "sunlight_hours",
    "shade_level",
    "wind_exposure",
    "water_access",
    "drainage_quality",
    "avg_day_temp_c",
    "peak_surface_temp_c",
    "humidity_pct",
    "rainfall_level",
    "heat_island_score",
    "maintenance_level",
    "budget_level",
    "preferred_style",
    "edible_preference",
    "flowering_preference",
    "pet_safe_required",
    "irrigation_allowed",
)

# Exact names (case-insensitive) forbidden in the feature block.
LEAKAGE_EXACT: frozenset[str] = frozenset(
    {
        "run_id",
        "runid",
        "project_id",
        "userid",
        "user_id",
        "candidate_id",
        "candidateid",
        "photo_session_id",
        "photosessionid",
        "selected_candidate_id",
        "environment_snapshot_id",
        "space_id",
        "recommendation_id",
        "session_id",
        "id",
        "rank",
        "rank_position",
        "rank_score",
        "rankscore",
        "created_at",
        "updated_at",
        "recorded_at",
        "captured_at",
        "timestamp",
        "dwell_ms",
        "event_id",
    }
)

# Columns matching these regexes are treated as leakage if they appear as features.
LEAKAGE_REGEXES: tuple[re.Pattern[str], ...] = (
    re.compile(r"^.*_id$", re.I),
    re.compile(r"^.*_at$", re.I),
    re.compile(r".*timestamp.*", re.I),
    re.compile(r"^run_", re.I),
    re.compile(r"^candidate_", re.I),
)

# Not leakage but should not be trained as numeric/categorical features without intent.
METADATA_COLUMNS: frozenset[str] = frozenset({"data_source", "split", "fold"})


def _repo_ml_root() -> Path:
    return Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    root = _repo_ml_root()
    p = argparse.ArgumentParser(
        description="Validate HeatWise species training export CSV.",
    )
    p.add_argument(
        "path",
        type=Path,
        nargs="?",
        default=root / "data" / "training_export.csv",
        help="CSV path (default: ml-models/data/training_export.csv)",
    )
    p.add_argument(
        "--target-prefix",
        type=str,
        default="species_",
        help="Prefix for multi-label target columns",
    )
    p.add_argument(
        "--exclude-cols",
        type=str,
        default="",
        help="Comma-separated columns to ignore (e.g. data_source)",
    )
    p.add_argument(
        "--min-rows-eval",
        type=int,
        default=200,
        help="Warn if row count is below this (meaningful holdout eval)",
    )
    p.add_argument(
        "--min-positives",
        type=int,
        default=5,
        help="Warn if any species label has fewer than this many positives",
    )
    p.add_argument(
        "--fail-on-warn",
        action="store_true",
        help="Exit 1 if any warning is raised (strict CI)",
    )
    return p.parse_args()


def is_leakage_feature(name: str) -> bool:
    lower = name.strip().lower()
    if lower in LEAKAGE_EXACT:
        return True
    if lower.startswith("species_"):
        return False
    for rx in LEAKAGE_REGEXES:
        if rx.match(lower):
            return True
    return False


def validate(
    path: Path,
    target_prefix: str,
    exclude_cols: list[str],
    min_rows_eval: int,
    min_positives: int,
) -> tuple[list[str], list[str], bool]:
    """
    Returns (errors, warnings, ok_without_errors).
    """
    errors: list[str] = []
    warnings: list[str] = []

    if not path.is_file():
        errors.append(f"File not found: {path}")
        return errors, warnings, False

    try:
        df = pd.read_csv(path)
    except Exception as e:
        errors.append(f"Failed to read CSV: {e}")
        return errors, warnings, False

    n_rows, n_cols = df.shape
    lines: list[str] = []
    lines.append("=" * 60)
    lines.append("HeatWise species training export — validation report")
    lines.append("=" * 60)
    lines.append(f"File: {path.resolve()}")
    lines.append(f"Shape: {n_rows} rows × {n_cols} columns")
    lines.append("")

    if n_rows == 0:
        errors.append("Dataset has zero rows.")
        print("\n".join(lines + ["ERRORS:"] + errors))
        return errors, warnings, False

    exclude_set = {x.strip() for x in exclude_cols if x.strip()}
    all_cols = list(df.columns)
    target_cols = [c for c in all_cols if c.startswith(target_prefix)]

    if not target_cols:
        errors.append(
            f"No target columns with prefix {target_prefix!r}. "
            f"Expected columns like species_basil_sweet.",
        )

    feature_cols = [
        c for c in all_cols if c not in target_cols and c not in exclude_set
    ]

    # Required features
    missing_required = [c for c in REQUIRED_FEATURE_COLUMNS if c not in df.columns]
    if missing_required:
        errors.append(
            "Missing required feature column(s): " + ", ".join(missing_required),
        )

    if not feature_cols:
        errors.append("No feature columns after excluding targets and --exclude-cols.")

    # Leakage in feature space
    leaky = [c for c in feature_cols if is_leakage_feature(c)]
    if leaky:
        errors.append(
            "Leakage-prone column(s) present in feature space: "
            + ", ".join(sorted(leaky)),
        )

    meta_present = [c for c in feature_cols if c.lower() in METADATA_COLUMNS]
    if meta_present:
        warnings.append(
            "Metadata column(s) in features (exclude with --exclude-cols when training): "
            + ", ".join(meta_present),
        )

    # Targets: binary 0/1
    if target_cols:
        Y = df[target_cols].apply(pd.to_numeric, errors="coerce")
        bad_cells = 0
        for col in target_cols:
            s = Y[col]
            finite = s.dropna()
            if len(finite) == 0:
                bad_cells += len(s)
                continue
            non_bin = ~finite.isin([0, 1])
            bad_cells += int(non_bin.sum())
            bad_cells += int(s.isna().sum())

        if bad_cells > 0:
            errors.append(
                f"Target columns must be binary {{0,1}} only; "
                f"found {bad_cells} invalid/NaN cell(s) across species_* columns.",
            )

    # Missing value report (features only)
    lines.append("-" * 60)
    lines.append("Missing values (feature columns)")
    lines.append("-" * 60)
    if feature_cols:
        X = df[feature_cols]
        total_missing = pd.Series(0, index=X.columns, dtype=float)
        for c in X.columns:
            col = X[c]
            if pd.api.types.is_numeric_dtype(col):
                total_missing[c] = col.isna().sum()
            else:
                s = col.astype(str).str.strip()
                total_missing[c] = (
                    col.isna() | s.eq("") | s.str.lower().isin(("nan", "none"))
                ).sum()
        pct = (total_missing / n_rows * 100).round(2)
        rep = pd.DataFrame({"missing": total_missing, "pct": pct})
        rep = rep[rep["missing"] > 0].sort_values("missing", ascending=False)
        if rep.empty:
            lines.append("  (no missing values in feature columns)")
        else:
            for col, row in rep.iterrows():
                lines.append(
                    f"  {col}: {int(row['missing'])} ({row['pct']:.2f}% of rows)",
                )
    else:
        lines.append("  (skipped — no feature columns)")
    lines.append("")

    # Class imbalance (targets)
    lines.append("-" * 60)
    lines.append("Label distribution (species_* targets)")
    lines.append("-" * 60)
    rare_labels: list[str] = []
    if target_cols:
        Y = df[target_cols].apply(pd.to_numeric, errors="coerce").fillna(0).clip(0, 1)
        for col in sorted(target_cols):
            pos = int(Y[col].sum())
            neg = n_rows - pos
            rate = pos / n_rows * 100 if n_rows else 0.0
            lines.append(f"  {col}: positives={pos}, negatives={neg}, rate={rate:.2f}%")
            if pos < min_positives:
                rare_labels.append(f"{col} (positives={pos})")
        lines.append("")
        if rare_labels:
            warnings.append(
                f"Species label(s) with fewer than {min_positives} positive example(s): "
                + "; ".join(rare_labels),
            )
    else:
        lines.append("  (skipped — no target columns)")
    lines.append("")

    # Duplicate rows
    lines.append("-" * 60)
    lines.append("Duplicate rows")
    lines.append("-" * 60)
    dup_full = int(df.duplicated().sum())
    lines.append(f"  Full-row duplicates: {dup_full}")
    if feature_cols and target_cols:
        key_cols = [c for c in feature_cols if c in df.columns]
        if key_cols:
            dup_feat = int(df.duplicated(subset=key_cols).sum())
            lines.append(f"  Duplicate feature rows (subset={len(key_cols)} cols): {dup_feat}")
            if dup_feat > dup_full and dup_feat > 0:
                warnings.append(
                    "Same feature vector appears multiple times with possibly different "
                    f"labels ({dup_feat} rows, subset duplicate). Review data collection.",
                )
    lines.append("")
    if dup_full > 0:
        warnings.append(f"Found {dup_full} exact duplicate row(s).")

    # Size warnings
    if n_rows < min_rows_eval:
        warnings.append(
            f"Row count {n_rows} is below --min-rows-eval={min_rows_eval}; "
            "holdout metrics will be noisy.",
        )

    lines.append("-" * 60)
    lines.append("Summary")
    lines.append("-" * 60)
    lines.append(f"  Feature columns (after exclude): {len(feature_cols)}")
    lines.append(f"  Target columns: {len(target_cols)}")
    lines.append(f"  Blocking errors: {len(errors)}")
    lines.append(f"  Warnings: {len(warnings)}")
    lines.append("=" * 60)

    if errors:
        lines.append("ERRORS:")
        for e in errors:
            lines.append(f"  - {e}")
    if warnings:
        lines.append("WARNINGS:")
        for w in warnings:
            lines.append(f"  - {w}")
    if not errors and not warnings:
        lines.append("OK — no blocking issues or warnings.")

    print("\n".join(lines))
    return errors, warnings, len(errors) == 0


def main() -> int:
    args = parse_args()
    exclude = [c for c in args.exclude_cols.split(",") if c.strip()]
    errors, warnings, ok = validate(
        args.path,
        args.target_prefix,
        exclude,
        args.min_rows_eval,
        args.min_positives,
    )

    if not ok:
        return 1
    if args.fail_on_warn and warnings:
        print("\nStrict mode: failing on warnings.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

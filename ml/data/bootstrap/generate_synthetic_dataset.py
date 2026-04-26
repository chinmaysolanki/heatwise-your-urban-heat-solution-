#!/usr/bin/env python3
"""
HeatWise synthetic bootstrap — ML dataset builder CLI.

Loads ``config/generation_rules.json`` + ``config/species_library.json`` by default.

Examples::

    cd heatwise/ml/data/bootstrap
    python generate_synthetic_dataset.py --rows 2000 --seed 42 --profile balanced

    python generate_synthetic_dataset.py --rows 500 --output-dir ./outputs --with-missingness

    python generate_synthetic_dataset.py --flat-only --rows 10000 --output-dir ./outputs
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from synthetic_bootstrap.bootstrap_env import GenerationRulesError, configure_bootstrap
from synthetic_bootstrap.pipeline import run_pipeline, run_recommendation_ml_pipeline
from synthetic_bootstrap.registries import ProfileName


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Generate HeatWise synthetic ML datasets (projects + candidates + splits).",
    )
    p.add_argument(
        "--config-dir",
        type=Path,
        default=ROOT / "config",
        help="Directory containing generation_rules.json and species_library.json",
    )
    p.add_argument(
        "--generation-rules",
        type=Path,
        default=None,
        help="Optional override JSON merged on top of config-dir/generation_rules.json",
    )
    p.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "outputs",
        help="Base output directory (raw/, processed/, samples/ created here)",
    )
    p.add_argument(
        "--rows",
        type=int,
        default=5_000,
        help="Number of projects (ranking pipeline) or flat rows (--flat-only)",
    )
    p.add_argument("--seed", type=int, default=42, help="RNG seed (deterministic)")
    p.add_argument(
        "--profile",
        type=str,
        default="balanced",
        choices=[
            "balanced",
            "budget",
            "premium",
            "hot-climate",
            "balcony-heavy",
            "rooftop-heavy",
        ],
        help="Sampling profile",
    )
    p.add_argument("--min-candidates", type=int, default=None, help="Override min candidates per project")
    p.add_argument("--max-candidates", type=int, default=None, help="Override max candidates per project")
    p.add_argument(
        "--flat-only",
        action="store_true",
        help="Emit single wide CSV only (legacy); default is full project/candidate ML pipeline",
    )
    p.add_argument(
        "--with-missingness",
        action="store_true",
        help="Inject NaNs using missing_rate + missing_columns from generation_rules.json",
    )
    p.add_argument(
        "--no-transforms",
        action="store_true",
        help="Skip processed/ tables and splits (raw + QA only)",
    )
    p.add_argument(
        "--no-splits",
        action="store_true",
        help="Build processed/ tables but skip train/val/test directories",
    )
    p.add_argument("--split-seed", type=int, default=None, help="RNG seed for split assignment")
    p.add_argument(
        "--validation-report",
        type=Path,
        default=ROOT / "validation_report.md",
        help="Path for QA markdown report",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    profile: ProfileName = args.profile  # type: ignore[assignment]
    config_dir = args.config_dir.resolve()

    try:
        cfg = configure_bootstrap(
            config_dir,
            generation_rules_override=args.generation_rules,
        )
    except (GenerationRulesError, ValueError, OSError) as e:
        print(f"Config error: {e}", file=sys.stderr)
        return 2

    if args.min_candidates is not None:
        cfg = replace(cfg, candidates_min=args.min_candidates)
    if args.max_candidates is not None:
        cfg = replace(cfg, candidates_max=args.max_candidates)
    if cfg.candidates_min > cfg.candidates_max:
        print("min-candidates must be <= max-candidates", file=sys.stderr)
        return 2

    if not args.with_missingness:
        cfg = replace(cfg, missing_rate=0.0)

    out = args.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)

    if args.flat_only:
        raw_flat = out / "raw"
        raw_flat.mkdir(parents=True, exist_ok=True)
        flat_path = raw_flat / "bootstrap_flat.csv"
        samples = out / "samples"
        result = run_pipeline(
            n_rows=args.rows,
            seed=args.seed,
            profile=profile,
            output_csv=flat_path,
            sample_dir=samples,
            missing_rate=cfg.missing_rate,
            gen_cfg=cfg,
        )
        args.validation_report.parent.mkdir(parents=True, exist_ok=True)
        args.validation_report.write_text(result.report.to_markdown(), encoding="utf-8")
        print(json.dumps({"mode": "flat", "rows": len(result.dataframe), "csv": str(flat_path)}, indent=2))
        if result.report.issues:
            return 1
        return 0

    res = run_recommendation_ml_pipeline(
        n_projects=args.rows,
        seed=args.seed,
        profile=profile,
        output_root=out,
        gen_cfg=cfg,
        with_missingness=args.with_missingness,
        run_transforms=not args.no_transforms,
        run_splits=not args.no_transforms and not args.no_splits,
        split_seed=args.split_seed,
        validation_report_path=args.validation_report,
        config_dir=config_dir,
    )

    summary = {
        "mode": "recommendation_ml",
        "n_projects": int(res.long_form_df["project_id"].nunique()),
        "n_candidates": len(res.long_form_df),
        "raw": {k: str(v) for k, v in res.raw_paths.items()},
        "qa_failed_checks": res.qa_failed,
        "qa_warnings": res.qa_warnings,
        "ranking_validation_issues": len(res.ranking_report.issues),
    }
    if res.processed_paths:
        summary["processed"] = {k: str(v) for k, v in res.processed_paths.items()}
    if res.split_result:
        summary["splits"] = res.split_result.get("summary")
    print(json.dumps(summary, indent=2))
    print(f"\nValidation report: {args.validation_report.resolve()}")

    if res.ranking_report.issues:
        print("Ranking structural issues:", file=sys.stderr)
        for i in res.ranking_report.issues:
            print(f"  - {i}", file=sys.stderr)
        return 1
    if res.qa_failed > 0:
        print(f"QA reported {res.qa_failed} failed checks (see validation report).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

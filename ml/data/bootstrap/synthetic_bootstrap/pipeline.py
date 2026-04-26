"""
End-to-end generation: flat table (legacy) and full ML recommendation dataset pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from synthetic_bootstrap.config import GenerationConfig
from synthetic_bootstrap.engine import synthesize_outputs
from synthetic_bootstrap.exports import species_training_features_dataframe
from synthetic_bootstrap.ranking import generate_ranking_dataframe
from synthetic_bootstrap.raw_pack import write_raw_recommendation_pack
from synthetic_bootstrap.registries import OUTPUT_COLUMNS, ProfileName
from synthetic_bootstrap.sampling import sample_input_features
from synthetic_bootstrap.split_io import assign_project_splits, export_split_directories
from synthetic_bootstrap.validation import ValidationReport, validate_dataframe, validate_ranking_dataframe


@dataclass
class GenerationResult:
    dataframe: pd.DataFrame
    report: ValidationReport
    output_path: Path


@dataclass
class RankingPackResult:
    ranking_df: pd.DataFrame
    report: ValidationReport
    paths: dict[str, Any]


@dataclass
class MLDatasetResult:
    """Outputs from :func:`run_recommendation_ml_pipeline`."""

    long_form_df: pd.DataFrame
    raw_paths: dict[str, Path]
    ranking_report: ValidationReport
    qa_failed: int
    qa_warnings: int
    processed_paths: dict[str, Path] | None
    split_result: dict[str, Any] | None


def _inject_missing(
    df: pd.DataFrame,
    rng: np.random.Generator,
    rate: float,
    columns_allow: tuple[str, ...],
) -> pd.DataFrame:
    if rate <= 0:
        return df
    out = df.copy()
    for col in columns_allow:
        if col not in out.columns:
            continue
        m = rng.random(len(out)) < rate
        out.loc[m, col] = np.nan
    return out


def generate_rows(
    n_rows: int,
    seed: int,
    profile: ProfileName,
    missing_rate: float = 0.0,
    gen_cfg: GenerationConfig | None = None,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows: list[dict[str, Any]] = []
    cfg = gen_cfg or GenerationConfig()
    miss_cols = tuple(cfg.missing_columns)

    for i in range(n_rows):
        sid = f"SYN-{seed:06d}-{i:06d}"
        inputs = sample_input_features(
            sid,
            rng,
            profile,
            sampling_overrides=cfg.sampling,
        )
        outputs = synthesize_outputs(inputs, rng)
        row = {**inputs, **outputs}
        rows.append(row)

    df = pd.DataFrame(rows)
    df = df.reindex(columns=list(OUTPUT_COLUMNS))
    df = _inject_missing(df, rng, missing_rate, miss_cols)
    return df


def write_sample_snippets(raw_dir: Path, samples_dir: Path, n: int = 100) -> None:
    samples_dir.mkdir(parents=True, exist_ok=True)
    for fn in ("projects.csv", "candidates.csv", "ranking_pairs.csv", "species_features.csv"):
        p = raw_dir / fn
        if not p.is_file():
            continue
        stem = fn.replace(".csv", "")
        pd.read_csv(p).head(n).to_csv(samples_dir / f"sample_{stem}.csv", index=False)


def run_pipeline(
    n_rows: int,
    seed: int,
    profile: ProfileName,
    output_csv: Path,
    sample_dir: Path,
    missing_rate: float = 0.0,
    gen_cfg: GenerationConfig | None = None,
) -> GenerationResult:
    cfg = gen_cfg or GenerationConfig()
    mr = cfg.missing_rate if gen_cfg else missing_rate
    df = generate_rows(n_rows, seed, profile, missing_rate=mr, gen_cfg=cfg)
    report = validate_dataframe(df)

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_csv, index=False)

    sample_dir.mkdir(parents=True, exist_ok=True)
    df.head(100).to_csv(sample_dir / "sample_100_rows.csv", index=False)
    df.head(1000).to_csv(sample_dir / "sample_1000_rows.csv", index=False)
    df.to_csv(sample_dir / "sample_full_rows.csv", index=False)

    return GenerationResult(dataframe=df, report=report, output_path=output_csv)


def run_ranking_pipeline(
    n_projects: int,
    seed: int,
    profile: ProfileName,
    export_dir: Path,
    gen_cfg: GenerationConfig,
    *,
    export_splits: bool = False,
    split_seed: int | None = None,
    split_out: Path | None = None,
) -> RankingPackResult:
    """Legacy long-form pack + optional split dirs (uses ``is_best_candidate`` era paths)."""
    ranking_df = generate_ranking_dataframe(n_projects, seed, profile, gen_cfg)
    report = validate_ranking_dataframe(ranking_df)

    from synthetic_bootstrap.exports import build_project_features_df, build_recommendation_labels_df

    d = Path(export_dir)
    d.mkdir(parents=True, exist_ok=True)
    paths: dict[str, Path] = {}
    ranking_df.to_csv(d / "ranking_long_form.csv", index=False)
    paths["ranking_long_form"] = d / "ranking_long_form.csv"

    pf = build_project_features_df(ranking_df)
    pf.to_csv(d / "project_features.csv", index=False)
    paths["project_features"] = d / "project_features.csv"

    lb = build_recommendation_labels_df(ranking_df)
    lb.to_csv(d / "recommendation_labels.csv", index=False)
    paths["recommendation_labels"] = d / "recommendation_labels.csv"

    sf = species_training_features_dataframe()
    sf.to_csv(d / "species_features.csv", index=False)
    paths["species_features"] = d / "species_features.csv"

    if export_splits:
        ss = split_seed if split_seed is not None else seed + 911
        manifest = assign_project_splits(
            ranking_df["project_id"].unique().tolist(),
            gen_cfg,
            ss,
        )
        split_root = split_out or (export_dir / "splits")
        spaths = export_split_directories(
            ranking_df,
            pf,
            manifest,
            split_root,
            labels_df=lb,
        )
        paths["splits"] = spaths
        species_training_features_dataframe().to_csv(split_root / "species_features.csv", index=False)

    return RankingPackResult(ranking_df=ranking_df, report=report, paths=paths)


def run_recommendation_ml_pipeline(
    n_projects: int,
    seed: int,
    profile: ProfileName,
    output_root: Path,
    gen_cfg: GenerationConfig,
    *,
    with_missingness: bool = False,
    run_transforms: bool = True,
    run_splits: bool = True,
    split_seed: int | None = None,
    validation_report_path: Path | None = None,
    config_dir: Path | None = None,
) -> MLDatasetResult:
    """
    Generate normalized raw tables under ``output_root/raw/``, QA report, processed tables, splits.

    Requires :func:`synthetic_bootstrap.bootstrap_env.configure_bootstrap` to have been called
    so species JSON is loaded.
    """
    import sys

    pkg_root = Path(__file__).resolve().parent.parent
    if str(pkg_root) not in sys.path:
        sys.path.insert(0, str(pkg_root))

    from synthetic_bootstrap.bootstrap_env import load_validation_rules
    from transforms.build_training_tables import build_training_tables
    from transforms.split_dataset import split_dataset
    from validators.dataset_validator import validate_and_write_report

    output_root = Path(output_root)
    raw_dir = output_root / "raw"
    processed_dir = output_root / "processed"
    samples_dir = output_root / "samples"

    long_df = generate_ranking_dataframe(n_projects, seed, profile, gen_cfg)
    if with_missingness and gen_cfg.missing_rate > 0:
        rng = np.random.default_rng(seed + 404)
        long_df = _inject_missing(
            long_df,
            rng,
            gen_cfg.missing_rate,
            tuple(gen_cfg.missing_columns),
        )

    ranking_report = validate_ranking_dataframe(long_df)
    raw_paths = write_raw_recommendation_pack(long_df, raw_dir, write_species=True)
    write_sample_snippets(raw_dir, samples_dir, n=100)

    rules: dict[str, Any] = {}
    if config_dir is not None:
        rules = load_validation_rules(Path(config_dir))

    report_path = (
        Path(validation_report_path)
        if validation_report_path
        else (output_root.parent / "validation_report.md")
    )

    qa = validate_and_write_report(raw_dir, report_path, rules)
    processed_paths: dict[str, Path] | None = None
    split_result: dict[str, Any] | None = None

    if run_transforms:
        processed_paths = build_training_tables(raw_dir, processed_dir)
    if run_splits and processed_paths is not None:
        ss = split_seed if split_seed is not None else seed + 911
        split_result = split_dataset(
            processed_dir,
            train_ratio=gen_cfg.train_ratio,
            val_ratio=gen_cfg.val_ratio,
            test_ratio=gen_cfg.test_ratio,
            seed=ss,
        )

    return MLDatasetResult(
        long_form_df=long_df,
        raw_paths=raw_paths,
        ranking_report=ranking_report,
        qa_failed=qa.failed_checks,
        qa_warnings=qa.warning_count,
        processed_paths=processed_paths,
        split_result=split_result,
    )

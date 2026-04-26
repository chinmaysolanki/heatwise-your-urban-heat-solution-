"""Generation determinism, rank consistency, config loading, split leakage."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from synthetic_bootstrap.bootstrap_env import configure_bootstrap
from synthetic_bootstrap.config import GenerationConfig, resolve_config
from synthetic_bootstrap.pipeline import run_recommendation_ml_pipeline
from synthetic_bootstrap.ranking import generate_ranking_dataframe
from synthetic_bootstrap.raw_pack import build_ranking_pairs, long_form_to_projects_candidates
from synthetic_bootstrap.table_schemas import LABEL_COLUMNS
from synthetic_bootstrap.validation import assert_split_disjoint, validate_ranking_dataframe


@pytest.fixture
def cfg() -> GenerationConfig:
    return GenerationConfig(candidates_min=3, candidates_max=3, missing_rate=0.0)


def test_deterministic_generation(cfg: GenerationConfig) -> None:
    configure_bootstrap(Path(__file__).resolve().parent.parent / "config")
    a = generate_ranking_dataframe(5, seed=99, profile="balanced", gen_cfg=cfg)
    b = generate_ranking_dataframe(5, seed=99, profile="balanced", gen_cfg=cfg)
    pd.testing.assert_frame_equal(a.reset_index(drop=True), b.reset_index(drop=True))


def test_rank_and_best_candidate_consistency(cfg: GenerationConfig) -> None:
    configure_bootstrap(Path(__file__).resolve().parent.parent / "config")
    df = generate_ranking_dataframe(10, seed=1, profile="balanced", gen_cfg=cfg)
    rep = validate_ranking_dataframe(df)
    assert not rep.issues, rep.issues
    assert "best_candidate" in df.columns


def test_projects_candidates_split_roundtrip(cfg: GenerationConfig) -> None:
    configure_bootstrap(Path(__file__).resolve().parent.parent / "config")
    long_df = generate_ranking_dataframe(4, seed=2, profile="budget", gen_cfg=cfg)
    proj, cand = long_form_to_projects_candidates(long_df)
    assert len(proj) == 4
    assert len(cand) == 12
    pairs = build_ranking_pairs(cand)
    assert len(pairs) == 4 * 3  # C(3,2) per project


def test_ranking_pairs_preferred_has_better_rank(cfg: GenerationConfig) -> None:
    configure_bootstrap(Path(__file__).resolve().parent.parent / "config")
    long_df = generate_ranking_dataframe(2, seed=3, profile="balanced", gen_cfg=cfg)
    _, cand = long_form_to_projects_candidates(long_df)
    pairs = build_ranking_pairs(cand)
    rank_map = cand.set_index("candidate_id")["rank_position"].to_dict()
    for _, row in pairs.iterrows():
        assert rank_map[str(row["preferred_candidate_id"])] < rank_map[str(row["other_candidate_id"])]


def test_ml_pipeline_no_leakage(tmp_path, cfg: GenerationConfig) -> None:
    configure_bootstrap(Path(__file__).resolve().parent.parent / "config")
    out = tmp_path / "out"
    res = run_recommendation_ml_pipeline(
        40,
        seed=7,
        profile="balanced",
        output_root=out,
        gen_cfg=cfg,
        with_missingness=False,
        run_transforms=True,
        run_splits=True,
        split_seed=0,
        validation_report_path=tmp_path / "vr.md",
        config_dir=Path(__file__).resolve().parent.parent / "config",
    )
    assert res.split_result is not None
    manifest = pd.read_csv(out / "processed" / "splits" / "split_manifest.csv")
    assert_split_disjoint(manifest)
    train_p = set(manifest.loc[manifest["split"] == "train", "project_id"])
    val_p = set(manifest.loc[manifest["split"] == "val", "project_id"])
    assert train_p.isdisjoint(val_p)


def test_resolve_config_merges_user_json(tmp_path: Path) -> None:
    user = tmp_path / "u.json"
    user.write_text(
        '{"candidates_per_project": {"min": 4, "max": 4}, "missing_rate": 0.05}',
        encoding="utf-8",
    )
    cfg = resolve_config(user)
    assert cfg.candidates_min == 4 and cfg.candidates_max == 4
    assert cfg.missing_rate == 0.05


def test_recommendation_labels_schema(cfg: GenerationConfig) -> None:
    configure_bootstrap(Path(__file__).resolve().parent.parent / "config")
    df = generate_ranking_dataframe(3, seed=0, profile="balanced", gen_cfg=cfg)
    from synthetic_bootstrap.exports import build_recommendation_labels_df

    lb = build_recommendation_labels_df(df)
    for c in LABEL_COLUMNS:
        if c in df.columns:
            assert c in lb.columns

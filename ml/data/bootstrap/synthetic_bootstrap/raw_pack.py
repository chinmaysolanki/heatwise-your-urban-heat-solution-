"""
Write normalized raw tables (projects, candidates, ranking pairs, species).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pandas as pd

from synthetic_bootstrap.exports import species_training_features_dataframe
from synthetic_bootstrap.table_schemas import (
    CANDIDATE_COLUMNS,
    PROJECT_COLUMNS,
    RANKING_PAIR_COLUMNS,
)


def long_form_to_projects_candidates(long_df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Split long-form generator output into one project table and one candidates table."""
    proj_cols = [c for c in PROJECT_COLUMNS if c in long_df.columns]
    missing_p = [c for c in PROJECT_COLUMNS if c not in long_df.columns]
    if missing_p:
        raise ValueError(f"long_df missing project columns: {missing_p}")

    can_cols = [c for c in CANDIDATE_COLUMNS if c in long_df.columns]
    missing_c = [c for c in CANDIDATE_COLUMNS if c not in long_df.columns]
    if missing_c:
        raise ValueError(f"long_df missing candidate columns: {missing_c}")

    projects = long_df[proj_cols].drop_duplicates(subset=["project_id"], keep="first").reset_index(drop=True)
    candidates = long_df[can_cols].copy().reset_index(drop=True)
    return projects, candidates


def build_ranking_pairs(candidates: pd.DataFrame) -> pd.DataFrame:
    """
    Pairwise rows: lower ``rank_position`` (better) is preferred over higher.

    ``preference_label`` is always ``1`` (preferred beats other).
    """
    rows: list[dict[str, Any]] = []
    for pid, g in candidates.groupby("project_id", sort=False):
        g = g.sort_values("rank_position")
        ids = g["candidate_id"].astype(str).tolist()
        ranks = g["rank_position"].astype(int).tolist()
        for i in range(len(ids)):
            for j in range(len(ids)):
                if ranks[i] < ranks[j]:
                    rows.append(
                        {
                            "project_id": pid,
                            "preferred_candidate_id": ids[i],
                            "other_candidate_id": ids[j],
                            "preference_label": 1,
                        },
                    )
    return pd.DataFrame(rows, columns=list(RANKING_PAIR_COLUMNS))


def write_raw_recommendation_pack(
    long_df: pd.DataFrame,
    raw_dir: Path,
    *,
    write_species: bool = True,
) -> dict[str, Path]:
    """Write ``projects.csv``, ``candidates.csv``, ``ranking_pairs.csv``, ``species_features.csv``."""
    raw_dir = Path(raw_dir)
    raw_dir.mkdir(parents=True, exist_ok=True)
    projects, candidates = long_form_to_projects_candidates(long_df)
    pairs = build_ranking_pairs(candidates)

    paths: dict[str, Path] = {}
    p_proj = raw_dir / "projects.csv"
    p_cand = raw_dir / "candidates.csv"
    p_pairs = raw_dir / "ranking_pairs.csv"
    projects.to_csv(p_proj, index=False)
    candidates.to_csv(p_cand, index=False)
    pairs.to_csv(p_pairs, index=False)
    paths["projects"] = p_proj
    paths["candidates"] = p_cand
    paths["ranking_pairs"] = p_pairs

    if write_species:
        sp = raw_dir / "species_features.csv"
        species_training_features_dataframe().to_csv(sp, index=False)
        paths["species_features"] = sp
    return paths

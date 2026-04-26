"""
Per-project candidate slate generation (3–5 ranked recommendations).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

from synthetic_bootstrap.config import GenerationConfig
from synthetic_bootstrap.engine import synthesize_outputs
from synthetic_bootstrap.exports import (
    build_project_features_df,
    build_recommendation_labels_df,
    ranking_export_column_order,
    species_library_dataframe,
)
from synthetic_bootstrap.registries import OUTPUT_COLUMNS, ProfileName
from synthetic_bootstrap.sampling import sample_input_features


def generate_ranking_dataframe(
    n_projects: int,
    seed: int,
    profile: ProfileName,
    gen_cfg: GenerationConfig,
) -> pd.DataFrame:
    """
    For each project, sample inputs once, draw K∈[candidates_min,candidates_max] candidates,
    sort by ``overall_recommendation_score`` descending, assign ``rank_position`` 1..K.
    """
    rng = np.random.default_rng(seed)
    rows: list[dict[str, Any]] = []

    for i in range(n_projects):
        pid = f"PRJ-{seed:06d}-{i:06d}"
        inputs = sample_input_features(
            pid,
            rng,
            profile,
            sampling_overrides=gen_cfg.sampling,
        )
        inputs["project_id"] = pid
        inputs["sample_id"] = pid

        k = int(rng.integers(gen_cfg.candidates_min, gen_cfg.candidates_max + 1))
        raw: list[dict[str, Any]] = []
        for j in range(k):
            out = synthesize_outputs(inputs, rng)
            cid = f"{pid}-C{j:02d}"
            raw.append({**inputs, **out, "candidate_id": cid})

        raw.sort(key=lambda x: -float(x["overall_recommendation_score"]))
        for rank, c in enumerate(raw, start=1):
            c["rank_position"] = rank
            c["best_candidate"] = 1 if rank == 1 else 0
            rows.append(c)

    df = pd.DataFrame(rows)
    order = [c for c in ranking_export_column_order() if c in df.columns]
    extra = [c for c in df.columns if c not in order]
    df = df[order + extra]
    return df


def write_training_pack(
    ranking_df: pd.DataFrame,
    out_dir: Any,
    *,
    write_species: bool = True,
) -> dict[str, Any]:
    """Write ranking_candidates, project_features, recommendation_labels, species_features."""
    from pathlib import Path

    d = Path(out_dir)
    d.mkdir(parents=True, exist_ok=True)

    paths: dict[str, Path] = {}
    ranking_path = d / "ranking_candidates.csv"
    ranking_df.to_csv(ranking_path, index=False)
    paths["ranking_candidates"] = ranking_path

    pf = build_project_features_df(ranking_df)
    pp = d / "project_features.csv"
    pf.to_csv(pp, index=False)
    paths["project_features"] = pp

    lb = build_recommendation_labels_df(ranking_df)
    lp = d / "recommendation_labels.csv"
    lb.to_csv(lp, index=False)
    paths["recommendation_labels"] = lp

    if write_species:
        sf = species_library_dataframe()
        sp = d / "species_features.csv"
        sf.to_csv(sp, index=False)
        paths["species_features"] = sp

    return {"paths": paths, "project_features": pf, "recommendation_labels": lb}

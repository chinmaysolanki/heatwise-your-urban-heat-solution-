"""
Post-generation validation: impossible combinations, contradictions, basic stats.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class ValidationReport:
    """Structured summary; also rendered to markdown."""

    issues: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)

    def to_markdown(self) -> str:
        lines = [
            "# Synthetic bootstrap — validation report",
            "",
            "## Issues (contradictions / impossible rows)",
            "",
        ]
        if self.issues:
            for i in self.issues:
                lines.append(f"- {i}")
        else:
            lines.append("- None detected.")
        lines.extend(["", "## Warnings", ""])
        if self.warnings:
            for w in self.warnings:
                lines.append(f"- {w}")
        else:
            lines.append("- None.")
        lines.extend(["", "## Statistics", ""])
        for k, v in self.stats.items():
            lines.append(f"- **{k}**: {v}")
        lines.append("")
        return "\n".join(lines)


def validate_dataframe(df: pd.DataFrame) -> ValidationReport:
    report = ValidationReport()
    n = len(df)
    if n == 0:
        report.issues.append("Empty dataframe.")
        return report

    # Impossible: very dense greenery on tiny spaces
    bad_dense = (df["greenery_density"] == "very_dense") & (df["area_sqft"] < 70)
    c = int(bad_dense.sum())
    if c > 0:
        report.issues.append(
            f"very_dense greenery on area_sqft < 70: {c} rows ({100 * c / n:.3f}%)",
        )

    # Heavy irrigation on water stress without irrigation_possible
    irr = df["irrigation_type"].astype(str)
    bad_irr = irr.str.startswith("drip") & (df["irrigation_possible"] == 0)
    c2 = int(bad_irr.sum())
    if c2 > 0:
        report.warnings.append(
            f"Drip irrigation while irrigation_possible=0: {c2} rows (review heuristics).",
        )

    # Pet safe required but species names known-unsafe (heuristic string match)
    unsafe_tokens = ("cactus", "bougainvillea", "oleander", "dieffenbachia")
    if "child_pet_safe_required" in df.columns:
        mask = df["child_pet_safe_required"] == 1
        for col in ("species_primary", "species_secondary", "species_tertiary"):
            if col not in df.columns:
                continue
            low = df.loc[mask, col].astype(str).str.lower()
            for tok in unsafe_tokens:
                hit = low.str.contains(tok, na=False).sum()
                if int(hit) > 0:
                    report.warnings.append(
                        f"child_pet_safe_required=1 but {col} contains '{tok}': {int(hit)} rows",
                    )

    # Scores in [0, 1]
    score_cols = [
        "pollinator_support_score",
        "privacy_score",
        "feasibility_score",
        "safety_score",
        "recommendation_acceptance_likelihood",
        "long_term_success_likelihood",
        "heat_mitigation_score",
        "water_efficiency_score",
        "overall_recommendation_score",
    ]
    for c in score_cols:
        if c not in df.columns:
            continue
        s = df[c]
        if ((s < 0) | (s > 1)).any():
            report.issues.append(f"Column {c} has values outside [0, 1].")

    # Duplicates
    dup = int(df.duplicated().sum())
    report.stats["full_row_duplicates"] = dup
    report.stats["row_count"] = n

    nulls = df.isna().sum().sum()
    report.stats["total_null_cells"] = int(nulls)

    if "project_type" in df.columns:
        vc = df["project_type"].value_counts().head(10)
        report.stats["project_type_top"] = vc.to_dict()

    if "species_primary" in df.columns:
        vc = df["species_primary"].value_counts().head(10)
        report.stats["top_species_primary"] = vc.to_dict()

    for c in (
        "overall_recommendation_score",
        "heat_mitigation_score",
        "recommendation_acceptance_likelihood",
    ):
        if c in df.columns:
            report.stats[f"{c}_mean"] = round(float(df[c].mean()), 4)

    return report


def validate_ranking_dataframe(df: pd.DataFrame) -> ValidationReport:
    """
    Flat checks plus per-``project_id`` rank consistency and score monotonicity.
    """
    report = validate_dataframe(df)
    req = {"project_id", "candidate_id", "rank_position", "best_candidate"}
    if not req.issubset(df.columns):
        report.issues.append(f"ranking export missing columns: {req - set(df.columns)}")
        return report

    for pid, g in df.groupby("project_id", sort=False):
        n = len(g)
        ranks = sorted(int(x) for x in g["rank_position"].tolist())
        if ranks != list(range(1, n + 1)):
            report.issues.append(
                f"project_id={pid}: rank_position must be 1..{n}, got {ranks}",
            )
        best = int(g["best_candidate"].sum())
        if best != 1:
            report.issues.append(
                f"project_id={pid}: expected exactly one best_candidate, got {best}",
            )
        top = g.loc[g["rank_position"] == 1, "best_candidate"]
        if len(top) != 1 or int(top.iloc[0]) != 1:
            report.issues.append(
                f"project_id={pid}: rank_position=1 row must have best_candidate=1",
            )
        sr = g.sort_values("rank_position")
        sc = sr["overall_recommendation_score"].astype(float).values
        if len(sc) > 1 and not np.all(sc[:-1] + 1e-6 >= sc[1:]):
            report.issues.append(
                f"project_id={pid}: overall_recommendation_score not monotone non-increasing with rank",
            )

    report.stats["n_projects"] = int(df["project_id"].nunique())
    report.stats["n_candidates"] = len(df)
    return report


def assert_split_disjoint(manifest: pd.DataFrame) -> None:
    """Raises ValueError if any project appears in more than one split."""
    dup = manifest.groupby("project_id")["split"].nunique()
    bad = dup[dup > 1]
    if len(bad):
        raise ValueError(f"Projects in multiple splits: {bad.index.tolist()}")

"""
QA and validation for normalized bootstrap CSVs (projects, candidates, pairs, species).

Writes a markdown report suitable for CI and human review.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class DatasetQAReport:
    """Aggregated validation outcome."""

    issues: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    stats: dict[str, Any] = field(default_factory=dict)

    @property
    def failed_checks(self) -> int:
        return len(self.issues)

    @property
    def warning_count(self) -> int:
        return len(self.warnings)

    def to_markdown(self) -> str:
        lines = [
            "# HeatWise synthetic dataset — validation report",
            "",
            "## Summary",
            "",
            f"- **Total project records**: {self.stats.get('n_projects', 'n/a')}",
            f"- **Total candidate records**: {self.stats.get('n_candidates', 'n/a')}",
            f"- **Total ranking pair records**: {self.stats.get('n_pairs', 'n/a')}",
            f"- **Failed checks (errors)**: {self.failed_checks}",
            f"- **Warnings**: {self.warning_count}",
            "",
            "## Failed checks",
            "",
        ]
        if self.issues:
            for i in self.issues:
                lines.append(f"- {i}")
        else:
            lines.append("- None")
        lines.extend(["", "## Warnings", ""])
        if self.warnings:
            for w in self.warnings:
                lines.append(f"- {w}")
        else:
            lines.append("- None")
        lines.extend(["", "## Category & score distributions", ""])
        for k, v in sorted(self.stats.items()):
            if k.startswith("dist_") or k.startswith("score_") or k.startswith("budget_"):
                lines.append(f"- **{k}**: {v}")
        lines.extend(["", "## Top species usage (primary)", ""])
        lines.append(str(self.stats.get("top_species_primary", {})))
        lines.extend(["", "## Suspicious pattern summary", ""])
        lines.append(str(self.stats.get("suspicious_summary", {})))
        lines.append("")
        return "\n".join(lines)


def _budget_band_inr(b: float) -> str:
    if b < 40_000:
        return "<40k"
    if b < 100_000:
        return "40k-100k"
    if b < 200_000:
        return "100k-200k"
    return ">=200k"


def validate_dataset_files(
    projects_path: Path,
    candidates_path: Path,
    pairs_path: Path,
    species_path: Path | None,
    rules: dict[str, Any],
) -> DatasetQAReport:
    rep = DatasetQAReport()
    projects = pd.read_csv(projects_path)
    candidates = pd.read_csv(candidates_path)
    pairs = pd.read_csv(pairs_path)
    species_df = pd.read_csv(species_path) if species_path and species_path.is_file() else None

    rep.stats["n_projects"] = len(projects)
    rep.stats["n_candidates"] = len(candidates)
    rep.stats["n_pairs"] = len(pairs)
    if species_df is not None:
        rep.stats["n_species_rows"] = len(species_df)

    dense_max = float(rules.get("dense_greenery_area_sqft_max", 70))
    vdense_max = float(rules.get("very_dense_greenery_area_sqft_max", 90))
    tiny = float(rules.get("tiny_space_area_sqft", 50))
    balcony_tiny = float(rules.get("balcony_tiny_area_sqft", 120))
    null_max = float(rules.get("max_null_fraction_per_column", 0.12))
    cost_ratio = float(rules.get("install_cost_to_budget_ratio_warn", 1.35))
    water_stress_irr = float(rules.get("irrigation_drip_water_stress_min", 0.55))
    heavy_recs = set(rules.get("low_load_heavy_rec_types", ["intensive_green_roof_lite"]))
    unsafe_subs = tuple(rules.get("unsafe_species_substrings", ("oleander", "dieffenbachia")))
    heavy_green = set(rules.get("heavy_greenery_levels", ["dense", "very_dense"]))

    # --- Duplicate IDs ---
    if projects["project_id"].duplicated().any():
        rep.issues.append("Duplicate project_id in projects.csv")
    if candidates["candidate_id"].duplicated().any():
        rep.issues.append("Duplicate candidate_id in candidates.csv")

    # --- Null thresholds ---
    for name, df in ("projects", projects), ("candidates", candidates):
        for col in df.columns:
            frac = float(df[col].isna().mean())
            if frac > null_max:
                rep.warnings.append(f"{name}: column {col} null fraction {frac:.3f} exceeds {null_max}")

    # --- Rank & best_candidate ---
    for pid, g in candidates.groupby("project_id", sort=False):
        ranks = sorted(int(x) for x in g["rank_position"].tolist())
        if ranks != list(range(1, len(g) + 1)):
            rep.issues.append(f"project_id={pid}: invalid rank sequence {ranks}")
        if int(g["best_candidate"].sum()) != 1:
            rep.issues.append(f"project_id={pid}: best_candidate sum must be 1")
        top = g.loc[g["rank_position"] == 1, "best_candidate"]
        if len(top) != 1 or int(top.iloc[0]) != 1:
            rep.issues.append(f"project_id={pid}: rank 1 must have best_candidate=1")

    # --- Score ranges [0,1] ---
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
        if c not in candidates.columns:
            continue
        s = candidates[c].astype(float)
        if ((s < 0) | (s > 1)).any():
            rep.issues.append(f"Column {c} has values outside [0, 1]")

    # --- Monotone overall score with rank ---
    for pid, g in candidates.groupby("project_id", sort=False):
        sr = g.sort_values("rank_position")
        sc = sr["overall_recommendation_score"].astype(float).values
        if len(sc) > 1 and not np.all(sc[:-1] + 1e-6 >= sc[1:]):
            rep.issues.append(
                f"project_id={pid}: overall_recommendation_score not monotone non-increasing with rank",
            )

    # --- Join projects + candidates for rule checks ---
    m = candidates.merge(projects, on="project_id", how="left", suffixes=("", "_p"))

    # Dense / very_dense on small area
    bad_dense = (m["greenery_density"] == "very_dense") & (m["area_sqft"].astype(float) < vdense_max)
    if int(bad_dense.sum()) > 0:
        rep.issues.append(f"very_dense greenery on small area (<{vdense_max} sqft): {int(bad_dense.sum())} rows")

    bad_d = (m["greenery_density"] == "dense") & (m["area_sqft"].astype(float) < dense_max)
    if int(bad_d.sum()) > 0:
        rep.warnings.append(f"dense greenery on area_sqft < {dense_max}: {int(bad_d.sum())} rows")

    # Tiny balcony + heavy greenery
    tiny_balcony = (
        (m["project_type"] == "balcony")
        & (m["area_sqft"].astype(float) < balcony_tiny)
        & (m["greenery_density"].isin(heavy_green))
    )
    if int(tiny_balcony.sum()) > 0:
        rep.warnings.append(f"heavy greenery on small balcony (<{balcony_tiny} sqft): {int(tiny_balcony.sum())} rows")

    # Low load + heavy solution
    low_heavy = (m["load_capacity_level"] == "low") & (m["recommendation_type"].isin(heavy_recs))
    if int(low_heavy.sum()) > 0:
        rep.warnings.append(f"heavy recommendation_type on low load_capacity: {int(low_heavy.sum())} rows")

    # Irrigation vs water / flag
    irr = m["irrigation_type"].astype(str)
    water_av = m["water_availability"].astype(str)
    irrig_ok = m["irrigation_possible"].astype(int)
    # Heuristic "water stress" from availability
    stress_map = {"scarce": 0.9, "limited": 0.55, "adequate": 0.25, "plentiful": 0.1}
    ws = water_av.map(lambda x: stress_map.get(x, 0.5)).astype(float)
    ws = np.where(irrig_ok == 0, np.minimum(1.0, ws + 0.35), ws)
    bad_irr = irr.str.startswith("drip") & (irrig_ok == 0)
    if int(bad_irr.sum()) > 0:
        rep.issues.append(f"drip irrigation while irrigation_possible=0: {int(bad_irr.sum())} rows")
    bad_irr2 = irr.str.startswith("drip") & (ws > water_stress_irr)
    if int(bad_irr2.sum()) > 0:
        rep.warnings.append(
            f"drip irrigation under high water stress (heuristic): {int(bad_irr2.sum())} rows",
        )

    # Cost vs budget
    if "budget_inr" in m.columns and "estimated_install_cost_inr" in m.columns:
        ratio = m["estimated_install_cost_inr"].astype(float) / m["budget_inr"].astype(float).clip(lower=1)
        bad_cost = ratio > cost_ratio
        if int(bad_cost.sum()) > 0:
            rep.warnings.append(
                f"install cost > {cost_ratio}x budget: {int(bad_cost.sum())} rows (review heuristics)",
            )

    # Pet-safe vs species strings
    if "child_pet_safe_required" in m.columns:
        mask = m["child_pet_safe_required"].astype(int) == 1
        for col in ("species_primary", "species_secondary", "species_tertiary"):
            if col not in m.columns:
                continue
            low = m.loc[mask, col].astype(str).str.lower()
            for tok in unsafe_subs:
                hit = low.str.contains(tok.lower(), na=False).sum()
                if int(hit) > 0:
                    rep.warnings.append(
                        f"child_pet_safe_required=1 but {col} may contain unsafe token '{tok}': {int(hit)} rows",
                    )

    # --- Ranking pairs integrity ---
    c_ids = set(candidates["candidate_id"].astype(str))
    if len(pairs) > 0 and (pairs["preference_label"].astype(int) != 1).any():
        rep.issues.append("ranking_pairs: preference_label must be 1 for all rows")
    miss_pref = ~pairs["preferred_candidate_id"].astype(str).isin(c_ids)
    miss_other = ~pairs["other_candidate_id"].astype(str).isin(c_ids)
    if miss_pref.any():
        rep.issues.append("ranking_pairs: preferred_candidate_id not found in candidates")
    if miss_other.any():
        rep.issues.append("ranking_pairs: other_candidate_id not found in candidates")

    # --- Species table ---
    if species_df is not None:
        if species_df["species_name"].duplicated().any():
            rep.warnings.append("species_features: duplicate species_name rows")

    # --- Stats for report ---
    rep.stats["dist_project_type"] = (
        projects["project_type"].value_counts().to_dict() if "project_type" in projects.columns else {}
    )
    rep.stats["dist_recommendation_type"] = (
        candidates["recommendation_type"].value_counts().head(15).to_dict()
        if "recommendation_type" in candidates.columns
        else {}
    )
    if "overall_recommendation_score" in candidates.columns:
        s = candidates["overall_recommendation_score"].astype(float)
        rep.stats["score_overall_mean"] = round(float(s.mean()), 4)
        rep.stats["score_overall_std"] = round(float(s.std()), 4)
    if "budget_inr" in projects.columns:
        bands = projects["budget_inr"].astype(float).map(_budget_band_inr).value_counts().to_dict()
        rep.stats["budget_bands"] = bands
    if "species_primary" in candidates.columns:
        rep.stats["top_species_primary"] = candidates["species_primary"].value_counts().head(12).to_dict()

    rep.stats["suspicious_summary"] = {
        "errors": rep.failed_checks,
        "warnings": rep.warning_count,
        "notes": "Synthetic heuristic data; cross-check with domain experts before production labels.",
    }
    return rep


def validate_and_write_report(
    raw_dir: Path,
    report_path: Path,
    rules: dict[str, Any],
) -> DatasetQAReport:
    raw_dir = Path(raw_dir)
    report_path = Path(report_path)
    species_p = raw_dir / "species_features.csv"
    rep = validate_dataset_files(
        raw_dir / "projects.csv",
        raw_dir / "candidates.csv",
        raw_dir / "ranking_pairs.csv",
        species_p if species_p.is_file() else None,
        rules,
    )
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(rep.to_markdown(), encoding="utf-8")
    return rep

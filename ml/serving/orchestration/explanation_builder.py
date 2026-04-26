"""Structured explanations for UI / reporting (no LLM)."""

from __future__ import annotations

from typing import Any


def build_candidate_explanation(
    *,
    candidate: dict[str, Any],
    block_reasons: list[str],
    component_scores: dict[str, float],
    final_score: float,
    ml_available: dict[str, bool],
) -> dict[str, Any]:
    bullets: list[str] = []
    if block_reasons:
        bullets.append("Blocked by safety/business rules: " + ", ".join(block_reasons))
    else:
        if candidate.get("cooling_strategy"):
            bullets.append(f"Cooling approach: {candidate.get('cooling_strategy')}.")
        if candidate.get("species_primary"):
            bullets.append(f"Primary species suggestion: {candidate.get('species_primary')}.")
        if candidate.get("estimated_install_cost_inr"):
            bullets.append(f"Estimated install cost (INR): ~{int(candidate['estimated_install_cost_inr']):,}.")
        top = sorted(component_scores.items(), key=lambda x: -x[1])[:2]
        if top:
            bullets.append("Top score contributions: " + ", ".join(f"{k} ({v:.2f})" for k, v in top))

    return {
        "summaryBullets": bullets,
        "componentScores": component_scores,
        "finalBlendedScore": round(final_score, 4),
        "mlHeadsUsed": {k: v for k, v in ml_available.items()},
        "blocked": bool(block_reasons),
    }


def build_run_explanation(
    *,
    mode: str,
    rules_version: str,
    model_versions: dict[str, str | None],
    n_generated: int,
    n_blocked: int,
    n_ranked: int,
) -> dict[str, Any]:
    return {
        "mode": mode,
        "rulesVersion": rules_version,
        "modelVersions": model_versions,
        "counts": {
            "generated": n_generated,
            "hardBlocked": n_blocked,
            "ranked": n_ranked,
        },
    }

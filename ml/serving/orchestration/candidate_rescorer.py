"""
Blend rule prior + ML heads into a single ranking score.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class BlendWeights:
    rules: float = 0.25
    feasibility_ml: float = 0.25
    heat_ml: float = 0.25
    ranking_ml: float = 0.25

    def normalized(self) -> BlendWeights:
        s = self.rules + self.feasibility_ml + self.heat_ml + self.ranking_ml
        if s <= 0:
            return BlendWeights(1.0, 0.0, 0.0, 0.0)
        return BlendWeights(
            self.rules / s,
            self.feasibility_ml / s,
            self.heat_ml / s,
            self.ranking_ml / s,
        )


def default_blend_from_request(raw: dict[str, Any] | None) -> BlendWeights:
    if not raw:
        return BlendWeights().normalized()
    return BlendWeights(
        rules=float(raw.get("rules", 0.25)),
        feasibility_ml=float(raw.get("feasibilityMl", 0.25)),
        heat_ml=float(raw.get("heatMl", 0.25)),
        ranking_ml=float(raw.get("rankingMl", 0.25)),
    ).normalized()


def blend_scores(
    *,
    rule_score: float,
    feasibility_ml: float | None,
    heat_ml: float | None,
    ranking_ml: float | None,
    weights: BlendWeights,
) -> tuple[float, dict[str, float]]:
    w = weights.normalized()
    f = feasibility_ml if feasibility_ml is not None else rule_score
    h = heat_ml if heat_ml is not None else rule_score
    r_raw = float(ranking_ml if ranking_ml is not None else rule_score)
    r = max(0.0, min(1.0, r_raw))

    parts = {
        "rules": w.rules * rule_score,
        "feasibility_ml": w.feasibility_ml * f,
        "heat_ml": w.heat_ml * h,
        "ranking_ml": w.ranking_ml * r,
    }
    return sum(parts.values()), parts

from __future__ import annotations

from serving.orchestration.candidate_generator import generate_rule_candidates
from serving.orchestration.geo_adjustments import apply_geo_site_adjustments_to_ranked


def _row(cand: dict, blended: float = 0.7) -> dict:
    cid = str(cand.get("candidate_id"))
    return {
        "candidateId": cid,
        "blocked": False,
        "blockReasons": [],
        "scores": {"blended": blended, "blendParts": {}},
        "candidatePayload": {k: v for k, v in cand.items() if k != "rule_template_score"},
        "explanation": {},
    }


def test_geo_boosts_evapotranspiration_when_cooling_need_high() -> None:
    p = {"project_type": "rooftop", "budget_inr": 200_000}
    cands = generate_rule_candidates(p, {}, {}, max_candidates=2)
    rows = [_row(c) for c in cands]
    env = {"geo_cooling_need_score": 0.8, "geo_overall_confidence": 0.7, "geo_rules_version": "t"}
    out = apply_geo_site_adjustments_to_ranked(rows, env)
    et = [r for r in out if str(r["candidatePayload"].get("cooling_strategy")) == "evapotranspiration"]
    assert et
    assert float(et[0]["scores"]["blended"]) >= float(rows[0]["scores"]["blended"]) * 0.99

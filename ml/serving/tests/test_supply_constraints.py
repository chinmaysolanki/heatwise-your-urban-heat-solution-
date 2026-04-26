from __future__ import annotations

from serving.orchestration.candidate_generator import generate_rule_candidates
from serving.orchestration.supply_constraints import apply_supply_constraints_to_ranked


def _minimal_row(cand: dict, blended: float = 0.7, blocked: bool = False) -> dict:
    cid = str(cand.get("candidate_id"))
    return {
        "candidateId": cid,
        "blocked": blocked,
        "blockReasons": [],
        "scores": {
            "rulePrior": 0.7,
            "feasibilityMl": None,
            "heatMl": None,
            "rankingMl": None,
            "blended": 0.0 if blocked else blended,
            "blendParts": {},
        },
        "candidatePayload": {k: v for k, v in cand.items() if k != "rule_template_score"},
        "explanation": {
            "summaryBullets": [],
            "blocked": blocked,
        },
    }


def test_substitution_before_block(tmp_path) -> None:
    p = {"project_type": "rooftop", "budget_inr": 200_000}
    e = {}
    pref = {}
    cands = generate_rule_candidates(p, e, pref, max_candidates=3)
    rows = [_minimal_row(c) for c in cands]
    first_sp = str(rows[0]["candidatePayload"].get("species_primary") or "").lower()

    sc = {
        "version": 1,
        "context": {"region": "X", "climateZone": "Z", "monthOfYear": 6, "projectType": "rooftop"},
        "blockedSpecies": [first_sp] if first_sp else [],
        "seasonallyBlockedSpecies": [],
        "blockedMaterials": [],
        "blockedSolutionTypes": [],
        "substitutions": {first_sp: "Substitute Species X"} if first_sp else {},
        "speciesSoftPenalties": {},
        "solutionSoftPenalties": {},
        "globalSoftMultiplier": 1.0,
        "irrigationSoftMultiplier": 1.0,
        "structuralSoftMultiplier": 1.0,
        "readiness": {"supplyReadinessScore": 0.8, "seasonalReadinessScore": 0.8, "operationalRiskLevel": "low"},
        "deferInstallSuggested": False,
        "leadTimeNote": None,
        "regionalReadinessNote": None,
        "confidenceAdjustmentReason": None,
        "explanationNotes": [],
    }
    out = apply_supply_constraints_to_ranked(rows, sc)
    if first_sp:
        assert out[0]["explanation"].get("substituted_species")
        assert str(out[0]["candidatePayload"].get("species_primary")) == "Substitute Species X"


def test_seasonal_block_species(tmp_path) -> None:
    p = {"project_type": "rooftop", "budget_inr": 200_000}
    cands = generate_rule_candidates(p, {}, {}, max_candidates=2)
    rows = [_minimal_row(c) for c in cands]
    sp = str(rows[0]["candidatePayload"].get("species_primary") or "").strip().lower()
    sc = {
        "version": 1,
        "context": {"region": "X", "climateZone": "Z", "monthOfYear": 6, "projectType": "rooftop"},
        "blockedSpecies": [],
        "seasonallyBlockedSpecies": [sp],
        "blockedMaterials": [],
        "blockedSolutionTypes": [],
        "substitutions": {},
        "speciesSoftPenalties": {},
        "solutionSoftPenalties": {},
        "globalSoftMultiplier": 1.0,
        "irrigationSoftMultiplier": 1.0,
        "structuralSoftMultiplier": 1.0,
        "readiness": {"supplyReadinessScore": 0.8, "seasonalReadinessScore": 0.4, "operationalRiskLevel": "medium"},
        "deferInstallSuggested": False,
        "leadTimeNote": None,
        "regionalReadinessNote": None,
        "confidenceAdjustmentReason": None,
        "explanationNotes": [],
    }
    out = apply_supply_constraints_to_ranked(rows, sc)
    assert out[0]["blocked"] is True
    assert out[0]["explanation"].get("blocked_due_to_season")


def test_soft_penalty_reduces_blended(tmp_path) -> None:
    p = {"project_type": "rooftop", "budget_inr": 200_000}
    cands = generate_rule_candidates(p, {}, {}, max_candidates=1)
    rows = [_minimal_row(cands[0], blended=1.0)]
    sp = str(rows[0]["candidatePayload"].get("species_primary") or "").strip().lower()
    sc = {
        "version": 1,
        "context": {"region": "X", "climateZone": "Z", "monthOfYear": 6, "projectType": "rooftop"},
        "blockedSpecies": [],
        "seasonallyBlockedSpecies": [],
        "blockedMaterials": [],
        "blockedSolutionTypes": [],
        "substitutions": {},
        "speciesSoftPenalties": {sp: {"multiplier": 0.5, "reason": "test"}},
        "solutionSoftPenalties": {},
        "globalSoftMultiplier": 1.0,
        "irrigationSoftMultiplier": 1.0,
        "structuralSoftMultiplier": 1.0,
        "readiness": {"supplyReadinessScore": 0.9, "seasonalReadinessScore": 0.9, "operationalRiskLevel": "low"},
        "deferInstallSuggested": False,
        "leadTimeNote": None,
        "regionalReadinessNote": None,
        "confidenceAdjustmentReason": None,
        "explanationNotes": [],
    }
    out = apply_supply_constraints_to_ranked(rows, sc)
    assert out[0]["scores"]["blended"] == 0.5

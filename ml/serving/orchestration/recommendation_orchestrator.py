"""
End-to-end runtime recommendation: rules → filter → ML scores → blend → rank → explain.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from serving.loaders.load_inference_bundle import InferenceBundle, load_production_bundles, resolve_registry_dir
from serving.orchestration.candidate_filter import evaluate_hard_constraints
from serving.orchestration.candidate_generator import generate_rule_candidates
from serving.orchestration.candidate_rescorer import BlendWeights, blend_scores, default_blend_from_request
from serving.orchestration.explanation_builder import build_candidate_explanation, build_run_explanation
from serving.orchestration.geo_adjustments import apply_geo_site_adjustments_to_ranked, geo_telemetry_meta
from serving.orchestration.supply_constraints import apply_supply_constraints_to_ranked, supply_constraints_applied_meta
from serving.scoring.feasibility_scorer import score_feasibility
from serving.scoring.heat_score_scorer import score_heat
from serving.scoring.ranking_scorer import score_ranking_relevance
from serving.species.catalog_code_resolve import enrich_ranked_rows_catalog_identity

RULES_VERSION_DEFAULT = "hw-rules-v1.2"


def _species_path(req: dict[str, Any]) -> Path | None:
    p = req.get("speciesCsvPath") or os.environ.get("HEATWISE_SPECIES_CSV")
    if p and Path(str(p)).is_file():
        return Path(str(p))
    return None


def run_recommendation_request(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Input shape matches ``manifests/runtime_contract.json`` request object.
    """
    project = dict(payload.get("project") or {})
    environment = dict(payload.get("environment") or {})
    preferences = dict(payload.get("preferences") or {})
    max_c = int(payload.get("maxCandidates") or 8)
    rules_ver = str(payload.get("rulesVersion") or RULES_VERSION_DEFAULT)
    blend = default_blend_from_request(payload.get("blendWeights"))

    ml_errors: list[str] = []
    bundles: dict[str, InferenceBundle | None] = {"feasibility": None, "heat_score": None, "ranking": None}

    try:
        reg = resolve_registry_dir(payload.get("registryDir"))
        bundles = load_production_bundles(reg)
    except Exception as e:  # noqa: BLE001
        ml_errors.append(f"registry:{e}")

    species_csv = _species_path(payload)

    raw_candidates = generate_rule_candidates(project, environment, preferences, max_candidates=max_c)

    scored_rows: list[dict[str, Any]] = []

    feas_b, heat_b, rank_b = bundles["feasibility"], bundles["heat_score"], bundles["ranking"]
    ml_ok = {
        "feasibility": feas_b is not None,
        "heat": heat_b is not None,
        "ranking": rank_b is not None,
    }

    for cand in raw_candidates:
        cid = str(cand.get("candidate_id"))
        block_reasons = evaluate_hard_constraints(project, environment, preferences, cand)

        f_sc, f_err = score_feasibility(feas_b, project, environment, preferences, cand, species_csv)
        if f_err and f_err != "no_bundle":
            ml_errors.append(f"feasibility:{cid}:{f_err}")

        h_sc, h_err = score_heat(heat_b, project, environment, preferences, cand, species_csv)
        if h_err and h_err != "no_bundle":
            ml_errors.append(f"heat:{cid}:{h_err}")

        r_sc, r_err = score_ranking_relevance(rank_b, project, environment, preferences, cand, species_csv)
        if r_err and r_err != "no_bundle":
            ml_errors.append(f"ranking:{cid}:{r_err}")

        rule_prior = float(cand.get("rule_template_score") or 0.5)

        final, parts = blend_scores(
            rule_score=rule_prior,
            feasibility_ml=f_sc,
            heat_ml=h_sc,
            ranking_ml=r_sc,
            weights=blend,
        )

        expl = build_candidate_explanation(
            candidate=cand,
            block_reasons=block_reasons,
            component_scores=parts,
            final_score=0.0 if block_reasons else final,
            ml_available={
                "feasibility": f_sc is not None,
                "heat": h_sc is not None,
                "ranking": r_sc is not None,
            },
        )

        scored_rows.append(
            {
                "candidateId": cid,
                "blocked": bool(block_reasons),
                "blockReasons": list(block_reasons),
                "scores": {
                    "rulePrior": rule_prior,
                    "feasibilityMl": f_sc,
                    "heatMl": h_sc,
                    "rankingMl": r_sc,
                    "blended": 0.0 if block_reasons else final,
                    "blendParts": parts,
                },
                "candidatePayload": {k: v for k, v in cand.items() if k != "rule_template_score"},
                "explanation": expl,
            },
        )

    supply_payload = payload.get("supplyConstraints")
    if isinstance(supply_payload, dict):
        scored_rows = apply_supply_constraints_to_ranked(scored_rows, supply_payload)

    scored_rows = apply_geo_site_adjustments_to_ranked(scored_rows, environment)
    enrich_ranked_rows_catalog_identity(scored_rows)

    # Sort: non-blocked first by blended desc, then blocked
    open_rows = [r for r in scored_rows if not r["blocked"]]
    blocked_rows = [r for r in scored_rows if r["blocked"]]
    open_rows.sort(key=lambda r: float(r["scores"]["blended"]), reverse=True)
    ranked = open_rows + blocked_rows
    for i, r in enumerate(ranked, start=1):
        r["rank"] = i

    any_ml = feas_b is not None or heat_b is not None or rank_b is not None
    all_ml = feas_b is not None and heat_b is not None and rank_b is not None
    if not any_ml:
        mode = "rules_only"
        gen_source = "live_rules"
    elif all_ml and not ml_errors:
        mode = "full_ml"
        gen_source = "hybrid"
    else:
        mode = "partial_ml"
        gen_source = "hybrid"

    telemetry = {
        "generatorSource": gen_source,
        "rulesVersion": rules_ver,
        "modelVersionFeasibility": feas_b.model_version if feas_b else None,
        "modelVersionHeat": heat_b.model_version if heat_b else None,
        "modelVersionRanking": rank_b.model_version if rank_b else None,
        "mlErrors": list(dict.fromkeys(ml_errors))[:50],
        "supplyConstraints": supply_constraints_applied_meta(supply_payload if isinstance(supply_payload, dict) else None),
        "geoIntelligence": geo_telemetry_meta(environment),
    }

    run_expl = build_run_explanation(
        mode=mode,
        rules_version=rules_ver,
        model_versions={
            "feasibility": telemetry["modelVersionFeasibility"],
            "heat_score": telemetry["modelVersionHeat"],
            "ranking": telemetry["modelVersionRanking"],
        },
        n_generated=len(raw_candidates),
        n_blocked=sum(1 for r in scored_rows if r["blocked"]),
        n_ranked=len(open_rows),
    )

    out: dict[str, Any] = {
        "mode": mode,
        "candidates": ranked,
        "telemetryMeta": telemetry,
        "runExplanation": run_expl,
        "errors": [] if not ml_errors else list(dict.fromkeys(ml_errors))[:20],
    }
    if isinstance(supply_payload, dict) and int(supply_payload.get("version") or 0) == 1:
        out["supplyIntelligenceMeta"] = {
            "context": supply_payload.get("context"),
            "readiness": supply_payload.get("readiness"),
            "explanationNotes": (supply_payload.get("explanationNotes") or [])[:20],
        }
    return out

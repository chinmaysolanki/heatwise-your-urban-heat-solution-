"""
Apply supply-side and seasonal constraints to scored recommendation rows.

Expects a compact ``supplyConstraints`` object on the runtime payload (built by
Node ``recommendationConstraintService``). Hard blocks merge with existing
rule blocks; soft penalties rescale blended scores after ML blending.
"""

from __future__ import annotations

from typing import Any


def _norm(s: Any) -> str:
    return str(s or "").strip().lower()


def _month_in_window(month: int, start: int, end: int) -> bool:
    if 1 <= start <= end <= 12:
        return start <= month <= end
    if 1 <= start <= 12 and 1 <= end <= 12:
        return month >= start or month <= end
    return False


def apply_supply_constraints_to_ranked(
    scored_rows: list[dict[str, Any]],
    supply_constraints: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if not supply_constraints or int(supply_constraints.get("version") or 0) != 1:
        return scored_rows

    blocked_species = {_norm(x) for x in (supply_constraints.get("blockedSpecies") or []) if x}
    seasonal_blocked = {_norm(x) for x in (supply_constraints.get("seasonallyBlockedSpecies") or []) if x}
    blocked_materials = {_norm(x) for x in (supply_constraints.get("blockedMaterials") or []) if x}
    blocked_solutions = {_norm(x) for x in (supply_constraints.get("blockedSolutionTypes") or []) if x}

    substitutions = {
        _norm(k): str(v).strip()
        for k, v in (supply_constraints.get("substitutions") or {}).items()
        if k and v
    }

    species_soft = supply_constraints.get("speciesSoftPenalties") or {}
    solution_soft = supply_constraints.get("solutionSoftPenalties") or {}

    global_soft = float(supply_constraints.get("globalSoftMultiplier") or 1.0)
    irr_soft = float(supply_constraints.get("irrigationSoftMultiplier") or 1.0)
    struct_soft = float(supply_constraints.get("structuralSoftMultiplier") or 1.0)

    readiness = supply_constraints.get("readiness") or {}
    op_risk = str(readiness.get("operationalRiskLevel") or "low")
    defer_suggested = bool(supply_constraints.get("deferInstallSuggested"))

    lead_note = supply_constraints.get("leadTimeNote")
    reg_note = supply_constraints.get("regionalReadinessNote")
    conf_reason = supply_constraints.get("confidenceAdjustmentReason")
    expl_notes = list(supply_constraints.get("explanationNotes") or [])

    for row in scored_rows:
        cand = row.get("candidatePayload") or {}
        expl = row.get("explanation") or {}
        rule_blocked = bool(row.get("blocked"))

        substituted: dict[str, str] | None = None
        sp_raw = cand.get("species_primary")
        sp = _norm(sp_raw)
        if sp in substitutions:
            to_name = substitutions[sp]
            substituted = {"from": str(sp_raw), "to": to_name}
            for key in ("species_primary", "species_secondary", "species_tertiary"):
                if key in cand:
                    cand[key] = to_name
            sp = _norm(to_name)

        blocked_supply: list[str] = []
        blocked_season: list[str] = []

        if sp and sp in blocked_species:
            blocked_supply.append(f"species_unavailable:{sp}")
        if sp and sp in seasonal_blocked:
            blocked_season.append(f"season_unsuitable:{sp}")

        shade = _norm(cand.get("shade_solution"))
        if shade and shade != "none" and shade in blocked_solutions:
            blocked_supply.append(f"solution_blocked:{shade}")

        planter = _norm(cand.get("planter_type"))
        if planter and planter in blocked_materials:
            blocked_supply.append(f"material_low_stock:{planter}")

        supply_hard = list(supply_constraints.get("hardBlockReasons") or [])
        for r in supply_hard:
            if r and r not in (row.get("blockReasons") or []):
                (row.setdefault("blockReasons", [])).append(str(r))

        if not rule_blocked and (blocked_supply or blocked_season):
            row["blocked"] = True
            for r in blocked_supply + blocked_season:
                if r not in (row.get("blockReasons") or []):
                    (row.setdefault("blockReasons", [])).append(r)
            row["scores"]["blended"] = 0.0
            expl["blocked"] = True

        elif not rule_blocked and not row.get("blocked"):
            blended = float(row["scores"].get("blended") or 0.0)
            soft = global_soft

            sp_key = sp
            if sp_key in species_soft and isinstance(species_soft[sp_key], dict):
                soft *= float(species_soft[sp_key].get("multiplier") or 1.0)

            sol_key = shade
            if sol_key in solution_soft and isinstance(solution_soft[sol_key], dict):
                soft *= float(solution_soft[sol_key].get("multiplier") or 1.0)

            if _norm(cand.get("irrigation_type")) in ("drip", "sprinkler", "automatic"):
                soft *= irr_soft
            if shade in ("pergola", "green_wall_segment", "shade_sail"):
                soft *= struct_soft

            blended *= max(0.05, min(1.0, soft))
            row["scores"]["blended"] = round(blended, 6)
            expl["finalBlendedScore"] = row["scores"]["blended"]

        now_vs_later = "later" if defer_suggested else "now"
        if op_risk == "high" and not defer_suggested:
            now_vs_later = "either"

        expl["substituted_species"] = substituted
        expl["blocked_due_to_supply"] = blocked_supply
        expl["blocked_due_to_season"] = blocked_season
        expl["operational_risk_level"] = op_risk
        expl["lead_time_note"] = lead_note
        expl["regional_readiness_note"] = reg_note
        expl["recommended_now_vs_later"] = now_vs_later
        expl["confidence_adjustment_reason"] = conf_reason
        if expl_notes:
            bullets = list(expl.get("summaryBullets") or [])
            for n in expl_notes[:5]:
                if n and n not in bullets:
                    bullets.append(str(n))
            expl["summaryBullets"] = bullets

        row["candidatePayload"] = cand
        row["explanation"] = expl

    return scored_rows


def supply_constraints_applied_meta(supply_constraints: dict[str, Any] | None) -> dict[str, Any]:
    if not supply_constraints or int(supply_constraints.get("version") or 0) != 1:
        return {"applied": False}
    ctx = supply_constraints.get("context") or {}
    return {
        "applied": True,
        "version": 1,
        "context": ctx,
        "blockedSpeciesCount": len(supply_constraints.get("blockedSpecies") or []),
        "seasonalBlockedCount": len(supply_constraints.get("seasonallyBlockedSpecies") or []),
    }


__all__ = [
    "apply_supply_constraints_to_ranked",
    "supply_constraints_applied_meta",
    "_month_in_window",
]

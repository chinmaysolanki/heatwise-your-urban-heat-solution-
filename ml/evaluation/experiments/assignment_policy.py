"""
Deterministic experiment assignment from stable keys and traffic percentages.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import Any, Literal

EvaluationMode = Literal["live", "shadow", "disabled"]


@dataclass(frozen=True)
class AssignmentResult:
    experiment_id: str
    assigned_variant: str
    """Bucket / treatment arm (may be shadow-computed only)."""
    served_variant: str
    """What the user actually receives (control when shadow dual-run)."""
    assignment_reason: str
    bucket_id: int
    evaluation_mode: EvaluationMode


def _stable_hash_int(key: str, salt: str) -> int:
    h = hashlib.sha256(f"{salt}|{key}".encode()).hexdigest()
    return int(h[:12], 16)


def _in_filters(
    context: dict[str, Any],
    filters: dict[str, Any],
) -> tuple[bool, str]:
    """Returns (ok, reason_if_not)."""
    if filters.get("internal_only") and not context.get("internal_user"):
        return False, "internal_only_experiment"

    uid = str(context.get("user_id") or "")
    if uid and filters.get("deny_user_ids") and uid in filters["deny_user_ids"]:
        return False, "user_denylisted"
    if filters.get("allow_user_ids"):
        if not uid or uid not in filters["allow_user_ids"]:
            return False, "user_not_allowlisted"

    pt = str(context.get("project_type") or "")
    if filters.get("project_types") and pt and pt not in filters["project_types"]:
        return False, "project_type_filtered"

    cz = str(context.get("climate_zone") or "")
    if filters.get("climate_zones") and cz and cz not in filters["climate_zones"]:
        return False, "climate_zone_filtered"

    ct = str(context.get("city_tier") or "")
    if filters.get("city_tiers") and ct and ct not in filters["city_tiers"]:
        return False, "city_tier_filtered"

    return True, ""


def assign_variant(
    experiment: dict[str, Any],
    assignment_key: str,
    context: dict[str, Any] | None = None,
) -> AssignmentResult | None:
    """
    ``assignment_key`` should be stable per subject (user_id preferred, else project_id, else session_id).
    """
    if experiment.get("status") != "active":
        return None

    ctx = context or {}
    filters = experiment.get("target_population_filters") or {}
    ok, reason = _in_filters(ctx, filters)
    ctrl = str(experiment.get("control_variant", "rules_only"))
    if not ok:
        return AssignmentResult(
            experiment_id=str(experiment["experiment_id"]),
            assigned_variant=ctrl,
            served_variant=ctrl,
            assignment_reason=f"filtered_out:{reason}",
            bucket_id=-1,
            evaluation_mode="disabled",
        )

    alloc = experiment.get("traffic_allocation") or {}
    if not alloc:
        return None

    variants = list(alloc.keys())
    weights = [max(0.0, float(alloc[v])) for v in variants]
    total = sum(weights)
    if total <= 0:
        return None

    eid = str(experiment["experiment_id"])
    ctrl = str(experiment.get("control_variant", "rules_only"))
    h = _stable_hash_int(assignment_key, eid) % 10_000
    bucket_id = h % 100  # 0-99 for reporting
    cumulative = 0.0
    threshold = (h / 10_000.0) * total
    assigned = variants[0]
    for v, w in zip(variants, weights, strict=False):
        cumulative += w
        if threshold < cumulative:
            assigned = v
            break

    shadow = experiment.get("shadow_config") or {}
    if shadow.get("enabled"):
        mode: EvaluationMode = "shadow"
        served = ctrl
    else:
        mode = "live"
        served = assigned

    return AssignmentResult(
        experiment_id=eid,
        assigned_variant=assigned,
        served_variant=served,
        assignment_reason="deterministic_hash_bucket",
        bucket_id=bucket_id,
        evaluation_mode=mode,
    )


def assignment_to_jsonable(a: AssignmentResult) -> dict[str, Any]:
    return {
        "experiment_id": a.experiment_id,
        "assigned_variant": a.assigned_variant,
        "served_variant": a.served_variant,
        "assignment_reason": a.assignment_reason,
        "bucket_id": a.bucket_id,
        "evaluation_mode": a.evaluation_mode,
    }


def serialize_assignment_payload(
    experiment: dict[str, Any],
    assignment: AssignmentResult | None,
    *,
    shadow_variant: str | None = None,
) -> dict[str, Any]:
    base: dict[str, Any] = {
        "experiment_id": experiment.get("experiment_id"),
        "primary_variant": experiment.get("primary_variant"),
        "shadow_variant": shadow_variant,
        "allocation_policy": experiment.get("allocation_policy"),
    }
    if assignment:
        base.update(assignment_to_jsonable(assignment))
    else:
        ctrl = experiment.get("control_variant", "rules_only")
        base.update(
            {
                "assigned_variant": ctrl,
                "served_variant": ctrl,
                "assignment_reason": "no_active_assignment",
                "bucket_id": -1,
                "evaluation_mode": "disabled",
            },
        )
    return base

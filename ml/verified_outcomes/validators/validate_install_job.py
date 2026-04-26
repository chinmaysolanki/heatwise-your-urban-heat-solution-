from __future__ import annotations

from typing import Any

VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    "scheduled": frozenset({"in_progress", "cancelled", "on_hold"}),
    "on_hold": frozenset({"scheduled", "cancelled", "in_progress"}),
    "in_progress": frozenset({"completed", "cancelled", "on_hold"}),
    "completed": frozenset(),
    "cancelled": frozenset(),
}


def validate_install_job_state(job_status: str, row: dict[str, Any]) -> tuple[bool, list[str]]:
    errs: list[str] = []
    st = (job_status or "").lower()
    if st == "completed" and not row.get("completed_at") and not row.get("completedAt"):
        errs.append("completed_requires_completed_at")
    if st == "cancelled":
        if not row.get("cancellation_reason") and not row.get("cancellationReason"):
            errs.append("cancelled_requires_cancellation_reason")
        if not row.get("cancelled_at") and not row.get("cancelledAt"):
            errs.append("cancelled_requires_cancelled_at")
    return len(errs) == 0, errs


def can_transition(from_status: str, to_status: str) -> bool:
    return to_status in VALID_TRANSITIONS.get(from_status, frozenset())


def validate_install_job(row: dict[str, Any]) -> tuple[bool, list[str]]:
    errs: list[str] = []
    ok, e = validate_install_job_state(str(row.get("job_status") or row.get("jobStatus") or ""), row)
    errs.extend(e)
    plan = row.get("install_plan_json") or row.get("installPlanJson")
    if plan is None:
        errs.append("install_plan_required")
    elif isinstance(plan, str) and not plan.strip():
        errs.append("install_plan_required")
    elif isinstance(plan, dict) and not plan:
        errs.append("install_plan_empty_object")
    return len(errs) == 0, errs

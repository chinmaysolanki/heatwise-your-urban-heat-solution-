from __future__ import annotations

from typing import Any

ALLOWED_OFFSETS = frozenset({7, 30, 90, 180})

EVENT_TYPES = frozenset({"completion", "missed", "rescheduled", "unreachable", "qualitative_note", "skipped"})

CHECKPOINT_STATUSES = frozenset({"pending", "completed", "missed", "rescheduled", "unreachable", "skipped"})

VALID_TRANSITIONS: dict[str, frozenset[str]] = {
    "pending": frozenset({"completed", "missed", "rescheduled", "unreachable", "skipped"}),
    "rescheduled": frozenset({"completed", "missed", "unreachable", "skipped", "pending"}),
    "completed": frozenset(),
    "missed": frozenset({"completed", "rescheduled", "skipped"}),
    "unreachable": frozenset({"completed", "rescheduled", "skipped"}),
    "skipped": frozenset(),
}


def validate_schedule_offsets(offsets: list[int]) -> tuple[bool, str]:
    if not offsets:
        return False, "offsets_non_empty"
    if len(set(offsets)) != len(offsets):
        return False, "offsets_unique"
    for o in offsets:
        if o not in ALLOWED_OFFSETS:
            return False, f"offset_not_allowed:{o}"
    return True, ""


def validate_followup_event(row: dict[str, Any]) -> tuple[bool, list[str]]:
    errs: list[str] = []
    et = str(row.get("event_type") or row.get("eventType") or "")
    if et not in EVENT_TYPES:
        errs.append("invalid_event_type")
    if not row.get("checkpoint_id") and not row.get("checkpointId"):
        errs.append("checkpoint_id_required")
    if et == "rescheduled":
        meta = row.get("metadata_json") or row.get("metadataJson")
        if isinstance(meta, str):
            import json

            try:
                meta = json.loads(meta)
            except json.JSONDecodeError:
                meta = {}
        if not isinstance(meta, dict):
            meta = {}
        if not meta.get("new_due_at") and not meta.get("newDueAt"):
            errs.append("rescheduled_requires_new_due_at_in_metadata")
    return len(errs) == 0, errs


def validate_checkpoint_transition(from_status: str, to_status: str) -> bool:
    return to_status in VALID_TRANSITIONS.get(from_status, frozenset())

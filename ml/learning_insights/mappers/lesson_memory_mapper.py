from __future__ import annotations

from typing import Any


def map_lesson_to_row(lesson: dict[str, Any]) -> dict[str, Any]:
    return {
        "lesson_memory_id": lesson.get("lesson_memory_id"),
        "lesson_key": lesson.get("lesson_key"),
        "polarity": lesson.get("polarity"),
        "confidence_band": lesson.get("confidence_band"),
        "related_segment_key": lesson.get("related_segment_key"),
        "created_by": lesson.get("created_by"),
        "evidence_ref_count": _evidence_count(lesson.get("evidence_refs_json")),
    }


def _evidence_count(raw: Any) -> int | None:
    if not isinstance(raw, str):
        return None
    try:
        import json

        x = json.loads(raw)
        return len(x) if isinstance(x, list) else None
    except json.JSONDecodeError:
        return None

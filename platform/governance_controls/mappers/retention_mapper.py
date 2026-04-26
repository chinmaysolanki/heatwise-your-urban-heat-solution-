from __future__ import annotations

import json
from typing import Any


def map_retention_policy_row(doc: dict[str, Any]) -> dict[str, Any]:
    notes = doc.get("notes") if isinstance(doc.get("notes"), dict) else {}
    return {
        "entity_category": doc.get("entity_category"),
        "default_retention_days": doc.get("default_retention_days"),
        "archive_after_days": doc.get("archive_after_days"),
        "hard_delete_after_days": doc.get("hard_delete_after_days"),
        "policy_version": doc.get("policy_version"),
        "notes_json": json.dumps(notes, sort_keys=True) if notes else "",
    }

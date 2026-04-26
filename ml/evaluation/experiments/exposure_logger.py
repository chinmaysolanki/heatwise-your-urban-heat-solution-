"""
Append-only exposure and evaluation records (JSONL) for offline analysis.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def log_exposure(
    data_dir: Path,
    experiment_id: str,
    record: dict[str, Any],
) -> Path:
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / f"exposures_{experiment_id}.jsonl"
    row = {"logged_at": _now_iso(), **record}
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return path


def log_evaluation(
    data_dir: Path,
    experiment_id: str,
    record: dict[str, Any],
) -> Path:
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    path = data_dir / f"evaluations_{experiment_id}.jsonl"
    row = {"logged_at": _now_iso(), **record}
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return path


def exposure_record_template() -> dict[str, Any]:
    """Field checklist for callers (documentation + defaults)."""
    return {
        "experiment_id": "",
        "assigned_variant": "",
        "primary_variant": "",
        "shadow_variant": None,
        "assignment_key": "",
        "request_timestamp": "",
        "project_id": "",
        "user_id": None,
        "recommendation_session_id": "",
        "top_candidate_id": "",
        "top_candidate_score": 0.0,
        "total_candidates": 0,
        "latency_ms": 0.0,
        "fallback_used": False,
        "rules_version": "",
        "model_versions": [],
        "environment_refs": {},
    }

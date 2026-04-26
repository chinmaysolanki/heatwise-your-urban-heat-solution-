"""Deterministic model version strings."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path


def _task_prefix(task: str) -> str:
    if task == "feasibility":
        return "feasibility"
    if task == "heat_score":
        return "heat_score"
    if task == "ranking":
        return "ranking"
    raise ValueError(f"unknown task: {task}")


def next_version(task: str, registry_dir: Path | None, when: datetime | None = None) -> str:
    """
    Pattern: ``{task_prefix}_v{YYYY}_{MM}_{DD}_{seq}`` e.g. ``feasibility_v2026_03_27_001``.
    Sequence counts existing entries in registry index for same task + date.
    """
    dt = when or datetime.now(timezone.utc)
    date_part = dt.strftime("%Y_%m_%d")
    prefix = _task_prefix(task)
    pat = re.compile(rf"^{prefix}_v{re.escape(date_part)}_(\d{{3}})$")

    max_seq = 0
    if registry_dir and Path(registry_dir).is_dir():
        idx = Path(registry_dir) / "registry_index.json"
        if idx.is_file():
            import json

            data = json.loads(idx.read_text(encoding="utf-8"))
            for e in data.get("models", []):
                if e.get("task") != task:
                    continue
                m = pat.match(str(e.get("version", "")))
                if m:
                    max_seq = max(max_seq, int(m.group(1)))

    return f"{prefix}_v{date_part}_{max_seq + 1:03d}"

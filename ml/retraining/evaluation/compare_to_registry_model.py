"""Load latest registry model metrics for comparison."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from retraining.registry.model_registry import ModelRegistry


def latest_metrics_for_task(
    registry_dir: Path,
    task: str,
    status: str = "production",
) -> dict[str, Any] | None:
    reg = ModelRegistry(registry_dir)
    entries = [e for e in reg.list_models() if e.get("task") == task and e.get("status") == status]
    if not entries:
        entries = [e for e in reg.list_models() if e.get("task") == task and e.get("status") == "staging"]
    if not entries:
        return None
    entries.sort(key=lambda x: str(x.get("trained_at", "")), reverse=True)
    path = entries[0].get("metrics_summary_path")
    if not path or not Path(path).is_file():
        return None
    import json

    return json.loads(Path(path).read_text(encoding="utf-8"))

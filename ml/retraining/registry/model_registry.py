"""
Filesystem-backed model registry (``registry_index.json`` + ``artifacts/``).
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class RegistryEntry:
    model_id: str
    model_name: str
    task: str
    version: str
    status: str
    trained_at: str
    training_snapshot_id: str
    artifact_paths: dict[str, str]
    training_code_version: str
    data_sources_used: list[str] = field(default_factory=list)
    source_mix_summary: dict[str, Any] = field(default_factory=dict)
    feature_manifest_path: str | None = None
    metrics_summary_path: str | None = None
    hyperparams: dict[str, Any] = field(default_factory=dict)
    inference_manifest_path: str | None = None
    parent_model_id: str | None = None
    notes: str | None = None
    promoted_at: str | None = None
    retired_at: str | None = None
    candidate_model_type: str | None = None
    experiment_name: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class ModelRegistry:
    def __init__(self, registry_dir: Path) -> None:
        self.registry_dir = Path(registry_dir)
        self.registry_dir.mkdir(parents=True, exist_ok=True)
        self.index_path = self.registry_dir / "registry_index.json"

    def _load(self) -> dict[str, Any]:
        if not self.index_path.is_file():
            return {"models": []}
        return json.loads(self.index_path.read_text(encoding="utf-8"))

    def _save(self, data: dict[str, Any]) -> None:
        self.index_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def list_models(self) -> list[dict[str, Any]]:
        return list(self._load().get("models", []))

    def append(self, entry: RegistryEntry) -> None:
        data = self._load()
        data.setdefault("models", []).append(entry.to_dict())
        self._save(data)

    def update_status(
        self,
        model_id: str,
        status: str,
        promoted_at: str | None = None,
        **extra: Any,
    ) -> None:
        data = self._load()
        for m in data.get("models", []):
            if m.get("model_id") == model_id:
                m["status"] = status
                if promoted_at:
                    m["promoted_at"] = promoted_at
                m.update({k: v for k, v in extra.items() if v is not None})
                break
        self._save(data)

    def retire_production(self, task: str, retired_at: str | None = None) -> None:
        ts = retired_at or datetime.now(timezone.utc).isoformat()
        data = self._load()
        for m in data.get("models", []):
            if m.get("task") == task and m.get("status") == "production":
                m["status"] = "archived"
                m["retired_at"] = ts
        self._save(data)

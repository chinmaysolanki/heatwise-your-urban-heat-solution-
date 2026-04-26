"""
Filesystem experiment registry (``experiments.json``).
"""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


@dataclass
class ExperimentRecord:
    experiment_id: str
    experiment_name: str
    status: str
    primary_variant: str
    allocation_policy: str
    traffic_allocation: dict[str, float]
    description: str = ""
    created_at: str = ""
    control_variant: str = "rules_only"
    treatment_variants: list[str] = field(default_factory=list)
    target_population_filters: dict[str, Any] = field(default_factory=dict)
    start_at: str | None = None
    end_at: str | None = None
    success_metrics: list[str] = field(default_factory=list)
    guardrail_metrics: list[str] = field(default_factory=list)
    shadow_config: dict[str, Any] = field(default_factory=dict)
    notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @staticmethod
    def new_draft(
        name: str,
        *,
        primary_variant: str,
        traffic_allocation: dict[str, float],
        allocation_policy: str = "deterministic_hash",
    ) -> ExperimentRecord:
        now = datetime.now(timezone.utc).isoformat()
        eid = f"exp_{uuid.uuid4().hex[:12]}"
        return ExperimentRecord(
            experiment_id=eid,
            experiment_name=name,
            status="draft",
            primary_variant=primary_variant,
            allocation_policy=allocation_policy,
            traffic_allocation=traffic_allocation,
            created_at=now,
            start_at=now,
        )


class ExperimentRegistry:
    def __init__(self, data_dir: Path) -> None:
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.store_path = self.data_dir / "experiments.json"

    def _load(self) -> dict[str, Any]:
        if not self.store_path.is_file():
            return {"experiments": []}
        return json.loads(self.store_path.read_text(encoding="utf-8"))

    def _save(self, data: dict[str, Any]) -> None:
        self.store_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def list_all(self) -> list[dict[str, Any]]:
        return list(self._load().get("experiments", []))

    def get(self, experiment_id: str) -> dict[str, Any] | None:
        for e in self.list_all():
            if e.get("experiment_id") == experiment_id:
                return e
        return None

    def upsert(self, record: ExperimentRecord | dict[str, Any]) -> None:
        d = record.to_dict() if isinstance(record, ExperimentRecord) else dict(record)
        data = self._load()
        exps = data.get("experiments", [])
        found = False
        for i, e in enumerate(exps):
            if e.get("experiment_id") == d.get("experiment_id"):
                exps[i] = d
                found = True
                break
        if not found:
            exps.append(d)
        data["experiments"] = exps
        self._save(data)

    def delete(self, experiment_id: str) -> bool:
        data = self._load()
        exps = [e for e in data.get("experiments", []) if e.get("experiment_id") != experiment_id]
        if len(exps) == len(data.get("experiments", [])):
            return False
        data["experiments"] = exps
        self._save(data)
        return True

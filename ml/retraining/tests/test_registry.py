from __future__ import annotations

import json
from pathlib import Path

from retraining.registry.model_registry import ModelRegistry, RegistryEntry


def test_registry_append_and_list(tmp_path: Path) -> None:
    reg = ModelRegistry(tmp_path)
    e = RegistryEntry(
        model_id="m1",
        model_name="test",
        task="feasibility",
        version="feasibility_v2099_01_01_001",
        status="candidate",
        trained_at="2099-01-01T00:00:00Z",
        training_snapshot_id="snap1",
        artifact_paths={"model.joblib": "/tmp/x"},
        training_code_version="1.0.0",
    )
    reg.append(e)
    models = reg.list_models()
    assert len(models) == 1
    assert models[0]["model_id"] == "m1"


def test_update_status_with_extra(tmp_path: Path) -> None:
    reg = ModelRegistry(tmp_path)
    reg.append(
        RegistryEntry(
            model_id="m2",
            model_name="test",
            task="ranking",
            version="ranking_v2099_01_01_001",
            status="candidate",
            trained_at="2099-01-01T00:00:00Z",
            training_snapshot_id="snap1",
            artifact_paths={},
            training_code_version="1.0.0",
        ),
    )
    reg.update_status("m2", "production", promoted_at="2099-01-02T00:00:00Z", inference_manifest_path="/b/manifest.json")
    m = reg.list_models()[0]
    assert m["status"] == "production"
    assert m["inference_manifest_path"] == "/b/manifest.json"


def test_retire_production(tmp_path: Path) -> None:
    reg = ModelRegistry(tmp_path)
    for mid, st in [("old", "production"), ("new", "candidate")]:
        reg.append(
            RegistryEntry(
                model_id=mid,
                model_name="x",
                task="feasibility",
                version=f"v_{mid}",
                status=st,
                trained_at="2099-01-01T00:00:00Z",
                training_snapshot_id="s",
                artifact_paths={},
                training_code_version="1",
            ),
        )
    reg.retire_production("feasibility")
    by_id = {m["model_id"]: m for m in reg.list_models()}
    assert by_id["old"]["status"] == "archived"
    assert by_id["new"]["status"] == "candidate"

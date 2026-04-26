from __future__ import annotations

from evaluation.experiments.experiment_registry import ExperimentRecord, ExperimentRegistry


def test_registry_crud(tmp_path) -> None:
    reg = ExperimentRegistry(tmp_path)
    e = ExperimentRecord.new_draft(
        "test",
        primary_variant="hybrid_v1",
        traffic_allocation={"rules_only": 100},
    )
    reg.upsert(e)
    assert reg.get(e.experiment_id) is not None
    reg.upsert(
        ExperimentRecord(
            **{**e.to_dict(), "status": "active"},
        ),
    )
    got = reg.get(e.experiment_id)
    assert got["status"] == "active"
    assert reg.delete(e.experiment_id) is True
    assert reg.get(e.experiment_id) is None

from __future__ import annotations

from evaluation.experiments.assignment_policy import assign_variant


def test_assign_variant_deterministic() -> None:
    exp = {
        "experiment_id": "exp_test",
        "status": "active",
        "control_variant": "rules_only",
        "primary_variant": "hybrid_v1",
        "allocation_policy": "deterministic_hash",
        "traffic_allocation": {"rules_only": 50, "hybrid_v1": 50},
        "target_population_filters": {},
    }
    a1 = assign_variant(exp, "user_stable_1", {})
    a2 = assign_variant(exp, "user_stable_1", {})
    assert a1 is not None and a2 is not None
    assert a1.assigned_variant == a2.assigned_variant
    assert a1.bucket_id == a2.bucket_id
    assert a1.served_variant == a1.assigned_variant


def test_shadow_mode_serves_control() -> None:
    exp = {
        "experiment_id": "exp_shadow",
        "status": "active",
        "control_variant": "rules_only",
        "primary_variant": "hybrid_v1",
        "allocation_policy": "deterministic_hash",
        "traffic_allocation": {"rules_only": 1, "hybrid_v1": 99},
        "target_population_filters": {},
        "shadow_config": {"enabled": True, "shadow_variant": "hybrid_v1"},
    }
    a = assign_variant(exp, "any_key", {})
    assert a is not None
    assert a.evaluation_mode == "shadow"
    assert a.served_variant == "rules_only"


def test_internal_only_filtered() -> None:
    exp = {
        "experiment_id": "exp_int",
        "status": "active",
        "control_variant": "rules_only",
        "primary_variant": "hybrid_v1",
        "allocation_policy": "deterministic_hash",
        "traffic_allocation": {"hybrid_v1": 100},
        "target_population_filters": {"internal_only": True},
    }
    a = assign_variant(exp, "u1", {"internal_user": False})
    assert a is not None
    assert a.evaluation_mode == "disabled"
    assert "filtered_out" in a.assignment_reason


def test_percentage_rollout_distribution() -> None:
    exp = {
        "experiment_id": "exp_dist",
        "status": "active",
        "control_variant": "rules_only",
        "primary_variant": "hybrid_v1",
        "allocation_policy": "deterministic_hash",
        "traffic_allocation": {"rules_only": 50, "hybrid_v1": 50},
        "target_population_filters": {},
    }
    hybrid = 0
    n = 2000
    for i in range(n):
        a = assign_variant(exp, f"key_{i}", {})
        assert a is not None
        if a.assigned_variant == "hybrid_v1":
            hybrid += 1
    assert 0.35 < hybrid / n < 0.65

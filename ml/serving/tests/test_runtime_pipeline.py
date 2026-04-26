from __future__ import annotations

import json
from pathlib import Path

import pytest

from serving.orchestration.candidate_filter import evaluate_hard_constraints
from serving.orchestration.candidate_generator import generate_rule_candidates
from serving.orchestration.candidate_rescorer import BlendWeights, blend_scores
from serving.orchestration.recommendation_orchestrator import run_recommendation_request


def test_generator_returns_candidates() -> None:
    p = {"project_type": "rooftop", "budget_inr": 100_000, "load_capacity_level": "medium"}
    e = {"water_availability": "moderate"}
    pref = {"purpose_primary": "cooling"}
    cands = generate_rule_candidates(p, e, pref, max_candidates=5)
    assert len(cands) >= 1
    assert "species_primary" in cands[0]


def test_hard_budget_block() -> None:
    cand = {"estimated_install_cost_inr": 200_000}
    p = {"budget_inr": 50_000}
    reasons = evaluate_hard_constraints(p, {}, {}, cand)
    assert "HARD_BUDGET_EXCEEDED" in reasons


def test_blend_scores() -> None:
    total, parts = blend_scores(
        rule_score=0.5,
        feasibility_ml=0.8,
        heat_ml=0.7,
        ranking_ml=0.6,
        weights=BlendWeights(0.25, 0.25, 0.25, 0.25),
    )
    assert total > 0
    assert set(parts.keys()) == {"rules", "feasibility_ml", "heat_ml", "ranking_ml"}


def test_orchestrator_rules_only_without_registry(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("HEATWISE_REGISTRY_DIR", raising=False)
    payload = {
        "project": {"project_type": "rooftop", "budget_inr": 200_000, "load_capacity_level": "medium"},
        "environment": {"water_availability": "moderate"},
        "preferences": {"purpose_primary": "cooling"},
        "maxCandidates": 4,
        "registryDir": str(tmp_path),
    }
    out = run_recommendation_request(payload)
    assert out["mode"] in ("rules_only", "partial_ml", "full_ml")
    assert len(out["candidates"]) >= 1
    assert "telemetryMeta" in out


def test_orchestrator_json_roundtrip_stdin_stdout(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    import io
    import sys

    from serving.__main__ import main

    monkeypatch.setenv("HEATWISE_REGISTRY_DIR", str(tmp_path))
    payload = {
        "project": {"project_type": "balcony", "budget_inr": 80_000, "floor_level": 3},
        "environment": {},
        "preferences": {},
        "maxCandidates": 3,
        "registryDir": str(tmp_path),
    }
    old_stdin = sys.stdin
    old_stdout = sys.stdout
    try:
        sys.stdin = io.StringIO(json.dumps(payload))
        buf = io.StringIO()
        sys.stdout = buf
        code = main()
        assert code == 0
        out = json.loads(buf.getvalue())
        assert "candidates" in out
        assert out.get("heatwiseServingOk") is True
    finally:
        sys.stdin = old_stdin
        sys.stdout = old_stdout


def test_main_exits_nonzero_on_unusable_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    import io
    import sys

    import serving.__main__ as serving_main

    def bad_run(_payload: dict) -> dict:
        return {
            "mode": "rules_only",
            "telemetryMeta": {"generatorSource": "live_rules", "rulesVersion": "hw-rules-v1.2", "mlErrors": []},
            "candidates": [],
        }

    monkeypatch.setattr(serving_main, "run_recommendation_request", bad_run)
    old_stdin = sys.stdin
    old_stdout = sys.stdout
    try:
        sys.stdin = io.StringIO('{"project":{},"environment":{},"preferences":{}}')
        buf = io.StringIO()
        sys.stdout = buf
        from serving.__main__ import main

        assert main() == 1
        assert buf.getvalue().strip() == ""
    finally:
        sys.stdin = old_stdin
        sys.stdout = old_stdout


def test_main_exits_nonzero_on_invalid_stdin_json() -> None:
    import io
    import sys

    old_stdin = sys.stdin
    old_stdout = sys.stdout
    try:
        sys.stdin = io.StringIO("not json {")
        buf = io.StringIO()
        sys.stdout = buf
        from serving.__main__ import main

        assert main() == 1
        assert buf.getvalue().strip() == ""
    finally:
        sys.stdin = old_stdin
        sys.stdout = old_stdout

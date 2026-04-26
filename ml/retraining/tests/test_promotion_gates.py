from __future__ import annotations

from pathlib import Path

from retraining.governance.promotion_gates import PromotionResult, evaluate_gates


def _touch(p: Path) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text("{}", encoding="utf-8")


def test_gate_reject_missing_artifact(tmp_path: Path) -> None:
    art = tmp_path / "a"
    art.mkdir()
    r, reasons = evaluate_gates(
        "feasibility",
        {"val": {"mae": 0.1, "r2": 0.5}},
        None,
        None,
        source_mix={"by_tier": {"post_install_validated": 100}},
        artifact_paths={"model.joblib": str(tmp_path / "missing")},
    )
    assert r == PromotionResult.REJECT
    assert any("missing_artifact" in x for x in reasons)


def test_gate_pass_with_artifacts(tmp_path: Path) -> None:
    d = tmp_path / "ok"
    d.mkdir()
    _touch(d / "model.joblib")
    _touch(d / "feature_manifest.json")
    _touch(d / "metrics.json")
    r, reasons = evaluate_gates(
        "feasibility",
        {"val": {"mae": 0.05, "r2": 0.8}},
        {"val": {"mae": 0.1, "r2": 0.5}},
        None,
        source_mix={"by_tier": {"post_install_validated": 100}},
        artifact_paths={
            "model.joblib": str(d / "model.joblib"),
            "feature_manifest.json": str(d / "feature_manifest.json"),
            "metrics.json": str(d / "metrics.json"),
        },
    )
    assert r == PromotionResult.PASS
    assert not reasons


def test_gate_staging_only_low_post_install(tmp_path: Path) -> None:
    d = tmp_path / "ok2"
    d.mkdir()
    _touch(d / "model.joblib")
    _touch(d / "feature_manifest.json")
    _touch(d / "metrics.json")
    r, _ = evaluate_gates(
        "feasibility",
        {"val": {"mae": 0.05, "r2": 0.8}},
        None,
        None,
        source_mix={"by_tier": {"post_install_validated": 0}},
        artifact_paths={
            "model.joblib": str(d / "model.joblib"),
            "feature_manifest.json": str(d / "feature_manifest.json"),
            "metrics.json": str(d / "metrics.json"),
        },
    )
    assert r == PromotionResult.PASS_TO_STAGING_ONLY

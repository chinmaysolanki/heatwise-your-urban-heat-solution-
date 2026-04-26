"""Smoke: registry dir resolution and load_production_bundles on empty/missing index."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

import json

import joblib

from serving.loaders.load_inference_bundle import (  # noqa: E402
    diagnose_production_bundle_loading,
    load_bundle,
    load_production_bundles,
    resolve_registry_dir,
)


def test_resolve_registry_dir_requires_value() -> None:
    with pytest.raises(ValueError, match="registry"):
        resolve_registry_dir(None)


def test_load_production_bundles_empty_dir(tmp_path: Path) -> None:
    out = load_production_bundles(tmp_path)
    assert out == {"feasibility": None, "heat_score": None, "ranking": None}


def test_diagnose_registry_no_index(tmp_path: Path) -> None:
    rep = diagnose_production_bundle_loading(tmp_path)
    assert rep["readiness"] == "no_index"
    assert rep["has_registry_index"] is False


def test_load_minimal_bundle_roundtrip(tmp_path: Path) -> None:
    """Prove serving can joblib-load a bundle that matches the export layout."""
    root = tmp_path / "feas_bundle"
    root.mkdir()
    manifest = {
        "task": "feasibility",
        "model_version": "e2e-stub",
        "model_id": "stub-id",
    }
    (root / "inference_manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    joblib.dump({"kind": "stub_model"}, root / "model.joblib")
    (root / "feature_manifest.json").write_text(
        json.dumps({"feature_names": ["x0", "x1"]}),
        encoding="utf-8",
    )
    b = load_bundle(root)
    assert b.task == "feasibility"
    assert b.model == {"kind": "stub_model"}
    assert b.feature_names() == ["x0", "x1"]

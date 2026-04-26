"""
Load sklearn inference bundles exported by ``ml/retraining/packaging/export_inference_bundle``.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import joblib


@dataclass
class InferenceBundle:
    """One promoted model bundle (directory containing inference_manifest.json + model.joblib)."""

    root: Path
    manifest: dict[str, Any]
    model: Any
    feature_manifest: dict[str, Any]
    pairwise_model: Any | None = None

    @property
    def task(self) -> str:
        return str(self.manifest.get("task", ""))

    @property
    def model_version(self) -> str:
        return str(self.manifest.get("model_version", ""))

    @property
    def model_id(self) -> str:
        return str(self.manifest.get("model_id", ""))

    def feature_names(self) -> list[str]:
        return list(self.feature_manifest.get("feature_names") or [])


def load_bundle(bundle_dir: Path) -> InferenceBundle:
    root = Path(bundle_dir).resolve()
    man_path = root / "inference_manifest.json"
    if not man_path.is_file():
        man_path = root.parent / "inference_manifest.json"
        if man_path.is_file():
            root = man_path.parent
    if not man_path.is_file():
        raise FileNotFoundError(f"inference_manifest.json not found under {bundle_dir}")

    manifest = json.loads(man_path.read_text(encoding="utf-8"))
    model_path = root / "model.joblib"
    if not model_path.is_file():
        files = manifest.get("artifact_files") or {}
        model_path = root / files.get("model", "model.joblib")
    model = joblib.load(model_path)

    fm_path = root / "feature_manifest.json"
    if not fm_path.is_file():
        fm_path = root / (manifest.get("feature_manifest_path") or "feature_manifest.json")
    feature_manifest = json.loads(fm_path.read_text(encoding="utf-8"))

    pair_path = root / "model_pairwise.joblib"
    pairwise = joblib.load(pair_path) if pair_path.is_file() else None

    return InferenceBundle(
        root=root,
        manifest=manifest,
        model=model,
        feature_manifest=feature_manifest,
        pairwise_model=pairwise,
    )


def resolve_registry_dir(explicit: str | None) -> Path:
    import os

    p = explicit or os.environ.get("HEATWISE_REGISTRY_DIR", "")
    if not p:
        raise ValueError("registry dir not set (HEATWISE_REGISTRY_DIR or request.registryDir)")
    return Path(p).resolve()


def load_production_bundles(
    registry_dir: Path,
    *,
    tasks: tuple[str, ...] = ("feasibility", "heat_score", "ranking"),
) -> dict[str, InferenceBundle | None]:
    """
    Load latest **production** bundle per task from ``registry_index.json``.
    """
    idx = registry_dir / "registry_index.json"
    if not idx.is_file():
        return {t: None for t in tasks}

    data = json.loads(idx.read_text(encoding="utf-8"))
    best: dict[str, tuple[str, Path]] = {}  # task -> (trained_at, bundle_root)

    for m in data.get("models", []):
        if m.get("status") != "production":
            continue
        task = str(m.get("task", ""))
        if task not in tasks:
            continue
        imp = m.get("inference_manifest_path")
        p: Path | None = Path(str(imp)) if imp else None
        if not p or not p.is_file():
            ap = m.get("artifact_paths") or {}
            mj = ap.get("model.joblib")
            if mj:
                alt = Path(str(mj)).parent / "inference_bundle" / "inference_manifest.json"
                if alt.is_file():
                    p = alt
        if p is None or not p.is_file():
            continue
        root = p.parent
        ts = str(m.get("trained_at", ""))
        if task not in best or ts > best[task][0]:
            best[task] = (ts, root)

    out: dict[str, InferenceBundle | None] = {}
    for t in tasks:
        if t not in best:
            out[t] = None
            continue
        try:
            out[t] = load_bundle(best[t][1])
        except (OSError, ValueError, json.JSONDecodeError, KeyError):
            out[t] = None
    return out


def diagnose_production_bundle_loading(registry_dir: Path) -> dict[str, Any]:
    """
    Human- and machine-readable readiness report for a registry root.

    **Failure modes** (common):
    - ``missing_registry_index`` — ``HEATWISE_REGISTRY_DIR`` does not contain ``registry_index.json``.
    - ``task_not_loaded`` — index exists but no production row, bad ``inference_manifest_path``, corrupt joblib, etc.
    """
    root = Path(registry_dir).resolve()
    idx = root / "registry_index.json"
    report: dict[str, Any] = {
        "registry_dir": str(root),
        "has_registry_index": idx.is_file(),
        "tasks": {},
        "failure_modes": [],
    }
    if not idx.is_file():
        report["readiness"] = "no_index"
        report["failure_modes"].append(
            "missing_registry_index: add registry_index.json or unset HEATWISE_REGISTRY_DIR for rules-only dev."
        )
        return report

    bundles = load_production_bundles(root)
    loaded = 0
    for task, b in bundles.items():
        if b is None:
            report["tasks"][task] = {"status": "not_loaded"}
            report["failure_modes"].append(
                f"task_not_loaded:{task} — check production rows, manifest paths, and artifact files."
            )
        else:
            loaded += 1
            report["tasks"][task] = {
                "status": "loaded",
                "model_version": b.model_version,
                "bundle_root": str(b.root),
            }

    n = len(bundles)
    if loaded == n:
        report["readiness"] = "full"
    elif loaded == 0:
        report["readiness"] = "none"
    else:
        report["readiness"] = "partial"
    report["summary"] = {"loaded": loaded, "expected": n}
    return report

"""
Export a self-contained inference bundle (model + manifests) for the runtime service.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


def export_inference_bundle(
    *,
    model_joblib_src: Path,
    feature_manifest_src: Path,
    metrics_src: Path | None,
    out_dir: Path,
    model_id: str,
    task: str,
    model_version: str,
    training_snapshot_id: str,
    trained_at: str,
    inference_config: dict[str, Any] | None = None,
    categorical_vocabulary: dict[str, Any] | None = None,
    expected_input_schema: dict[str, Any] | None = None,
    output_schema: dict[str, Any] | None = None,
) -> Path:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    shutil.copy2(model_joblib_src, out_dir / "model.joblib")
    shutil.copy2(feature_manifest_src, out_dir / "feature_manifest.json")
    if metrics_src and metrics_src.is_file():
        shutil.copy2(metrics_src, out_dir / "metrics.json")

    pre_meta = {
        "sklearn_pipeline": True,
        "fitted_encoders_inside_pipeline": True,
        "notes": "Load with joblib; use feature_manifest for column order and groups.",
    }
    (out_dir / "preprocessing_metadata.json").write_text(json.dumps(pre_meta, indent=2), encoding="utf-8")

    manifest: dict[str, Any] = {
        "bundle_version": "1",
        "model_id": model_id,
        "task": task,
        "model_version": model_version,
        "training_snapshot_id": training_snapshot_id,
        "trained_at": trained_at,
        "artifact_files": {
            "model": "model.joblib",
            "feature_manifest": "feature_manifest.json",
            "preprocessing_metadata": "preprocessing_metadata.json",
        },
        "feature_manifest_path": "feature_manifest.json",
        "preprocessing_metadata_path": "preprocessing_metadata.json",
        "inference_config": inference_config or {"batch_size_default": 32},
        "categorical_vocabulary": categorical_vocabulary or {},
        "expected_input_schema": expected_input_schema or {"type": "object", "description": "See feature_manifest.feature_names"},
        "output_schema": output_schema
        or {
            "type": "object",
            "properties": {"score": {"type": "number"}},
        },
        "model_metadata": {"task": task, "model_version": model_version},
    }
    p = out_dir / "inference_manifest.json"
    p.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return p

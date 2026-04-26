"""Filesystem artifact layout for one model version."""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


def ensure_run_dir(registry_dir: Path, model_id: str) -> Path:
    d = Path(registry_dir) / "artifacts" / model_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def write_json(path: Path, obj: Any) -> None:
    path.write_text(json.dumps(obj, indent=2), encoding="utf-8")


def copy_file(src: Path, dest_dir: Path, name: str | None = None) -> Path:
    dest = dest_dir / (name or src.name)
    shutil.copy2(src, dest)
    return dest


def save_sklearn_pipeline(pipe: Any, path: Path) -> None:
    import joblib

    joblib.dump(pipe, path)

"""
Load generation rules from JSON; merge over code defaults.
"""

from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "generation_rules.json"


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    out = deepcopy(base)
    for k, v in override.items():
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = deepcopy(v)
    return out


def load_generation_config(path: Path | None = None) -> dict[str, Any]:
    """Load JSON config; if path missing, use package default."""
    p = path if path is not None else DEFAULT_CONFIG_PATH
    if not p.is_file():
        return {}
    with p.open(encoding="utf-8") as f:
        return json.load(f)


@dataclass
class GenerationConfig:
    """Resolved knobs for ranking + exports."""

    candidates_min: int = 3
    candidates_max: int = 5
    missing_rate: float = 0.0
    missing_columns: tuple[str, ...] = (
        "railing_height_ft",
        "usable_area_pct",
        "orientation",
        "native_species_preference",
    )
    train_ratio: float = 0.7
    val_ratio: float = 0.15
    test_ratio: float = 0.15
    sampling: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_merged_dict(cls, d: dict[str, Any]) -> GenerationConfig:
        cpp = d.get("candidates_per_project") or {}
        sp = d.get("split") or {}
        return cls(
            candidates_min=int(cpp.get("min", 3)),
            candidates_max=int(cpp.get("max", 5)),
            missing_rate=float(d.get("missing_rate", 0.0)),
            missing_columns=tuple(
                d.get(
                    "missing_columns",
                    (
                        "railing_height_ft",
                        "usable_area_pct",
                        "orientation",
                        "native_species_preference",
                    ),
                ),
            ),
            train_ratio=float(sp.get("train_ratio", 0.7)),
            val_ratio=float(sp.get("val_ratio", 0.15)),
            test_ratio=float(sp.get("test_ratio", 0.15)),
            sampling=dict(d.get("sampling") or {}),
        )


def resolve_config(user_path: Path | None = None) -> GenerationConfig:
    base = load_generation_config(DEFAULT_CONFIG_PATH)
    if user_path and user_path.is_file():
        base = _deep_merge(base, load_generation_config(user_path))
    return GenerationConfig.from_merged_dict(base)

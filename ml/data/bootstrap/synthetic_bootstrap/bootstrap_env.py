"""
Load ``config_dir`` rules + species library and wire runtime state.

Call :func:`configure_bootstrap` once before generation (CLI does this automatically).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from synthetic_bootstrap.config import GenerationConfig, _deep_merge
from synthetic_bootstrap.species import set_species_library
from synthetic_bootstrap.species_loader import SpeciesConfigError, load_species_library_json


class GenerationRulesError(ValueError):
    """Invalid or missing ``generation_rules.json``."""


def _default_rules_dict() -> dict[str, Any]:
    """Embedded defaults if the on-disk default file is absent."""
    return {
        "version": 1,
        "candidates_per_project": {"min": 3, "max": 5},
        "missing_rate": 0.0,
        "missing_columns": [
            "railing_height_ft",
            "usable_area_pct",
            "orientation",
            "native_species_preference",
        ],
        "split": {"train_ratio": 0.7, "val_ratio": 0.15, "test_ratio": 0.15},
        "sampling": {},
        "validation": {},
    }


def load_generation_rules_merged(rules_path: Path) -> dict[str, Any]:
    base = _default_rules_dict()
    if not rules_path.is_file():
        raise GenerationRulesError(f"generation rules not found: {rules_path}")
    try:
        user = json.loads(rules_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise GenerationRulesError(f"invalid JSON in {rules_path}: {e}") from e
    if not isinstance(user, dict):
        raise GenerationRulesError("generation_rules.json must be a JSON object")
    return _deep_merge(base, user)


def load_validation_rules(config_dir: Path) -> dict[str, Any]:
    """Subset of generation rules used by :mod:`validators.dataset_validator`."""
    path = config_dir / "generation_rules.json"
    merged = load_generation_rules_merged(path)
    v = merged.get("validation")
    return dict(v) if isinstance(v, dict) else {}


def configure_bootstrap(
    config_dir: Path,
    *,
    generation_rules_override: Path | None = None,
) -> GenerationConfig:
    """
    Load species from ``config_dir/species_library.json`` and merge
    ``config_dir/generation_rules.json`` (plus optional override file) into generation knobs.
    """
    config_dir = config_dir.resolve()
    species_path = config_dir / "species_library.json"
    rules_path = config_dir / "generation_rules.json"

    try:
        lib = load_species_library_json(species_path)
    except SpeciesConfigError:
        raise
    set_species_library(lib)

    merged = load_generation_rules_merged(rules_path)
    if generation_rules_override and generation_rules_override.is_file():
        try:
            override = json.loads(generation_rules_override.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            raise GenerationRulesError(f"invalid JSON in override: {e}") from e
        if not isinstance(override, dict):
            raise GenerationRulesError("generation rules override must be a JSON object")
        merged = _deep_merge(merged, override)
    return GenerationConfig.from_merged_dict(merged)

"""
Run primary and shadow recommendation paths (Python serving) for offline shadow evaluation.

Variant routing uses registry directory: empty temp dir ⇒ rules-only (no bundle index);
production ``registry_dir`` ⇒ hybrid / ML-heavy when bundles exist.
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Any, Literal

from evaluation.shadow.shadow_comparator import compare_shadow_outputs

ShadowMode = Literal[
    "rules_only_primary_ml_shadow",
    "hybrid_primary_rules_shadow",
    "ml_primary_hybrid_shadow",
    "custom",
]


def _with_registry_dir(payload: dict[str, Any], registry_dir: str | None) -> dict[str, Any]:
    p = dict(payload)
    if registry_dir is not None:
        p["registryDir"] = registry_dir
    else:
        p.pop("registryDir", None)
    return p


def run_recommendation_pair(
    run_fn: Any,
    base_payload: dict[str, Any],
    *,
    primary_registry_dir: str | None,
    shadow_registry_dir: str | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """
    ``run_fn`` should be ``run_recommendation_request`` from serving orchestration
    (or a test double) accepting a payload dict.
    """
    primary = run_fn(_with_registry_dir(base_payload, primary_registry_dir))
    shadow = run_fn(_with_registry_dir(base_payload, shadow_registry_dir))
    return primary, shadow


def empty_rules_only_registry_dir() -> str:
    """Temporary empty directory → no promoted bundles → rules-only path."""
    return str(Path(tempfile.mkdtemp(prefix="heatwise_rules_only_")))


def run_shadow_mode(
    run_fn: Any,
    base_payload: dict[str, Any],
    mode: ShadowMode,
    production_registry_dir: str,
) -> dict[str, Any]:
    """
    Execute primary + shadow according to ``mode``; returns primary, shadow, comparison, meta.
    """
    prod = production_registry_dir
    empty = empty_rules_only_registry_dir()

    if mode == "rules_only_primary_ml_shadow":
        primary_dir, shadow_dir = empty, prod
    elif mode == "hybrid_primary_rules_shadow":
        primary_dir, shadow_dir = prod, empty
    elif mode == "ml_primary_hybrid_shadow":
        # v1: treat hybrid as prod registry; "ml_heavy" would use same dir until separate registry exists
        primary_dir, shadow_dir = prod, prod
    else:
        primary_dir, shadow_dir = prod, empty

    primary, shadow = run_recommendation_pair(
        run_fn,
        base_payload,
        primary_registry_dir=primary_dir,
        shadow_registry_dir=shadow_dir,
    )

    tm_p = primary.get("telemetryMeta") or {}
    tm_s = shadow.get("telemetryMeta") or {}
    meta_p = {
        "rules_version": primary.get("rules_version") or tm_p.get("rulesVersion"),
        "model_versions": primary.get("model_versions") or primary.get("model_version"),
        "latency_ms": primary.get("latency_ms") or tm_p.get("latencyMs"),
        "explanation": primary.get("runExplanation"),
    }
    meta_s = {
        "rules_version": shadow.get("rules_version") or tm_s.get("rulesVersion"),
        "model_versions": shadow.get("model_versions") or shadow.get("model_version"),
        "latency_ms": shadow.get("latency_ms") or tm_s.get("latencyMs"),
        "explanation": shadow.get("runExplanation"),
    }
    comp = compare_shadow_outputs(primary, shadow, meta_primary=meta_p, meta_shadow=meta_s)
    latency_delta = None
    try:
        lp = float(meta_p.get("latency_ms") or 0)
        ls = float(meta_s.get("latency_ms") or 0)
        latency_delta = ls - lp
    except (TypeError, ValueError):
        pass

    return {
        "mode": mode,
        "primary": primary,
        "shadow": shadow,
        "comparison": comp.to_dict(),
        "latency_delta_ms": latency_delta,
        "primary_registry_dir": primary_dir,
        "shadow_registry_dir": shadow_dir,
    }


def attach_experiment_metadata(
    row: dict[str, Any],
    *,
    experiment_id: str,
    rollout_phase: str | None = None,
) -> dict[str, Any]:
    return {
        **row,
        "experiment_id": experiment_id,
        "rollout_phase": rollout_phase,
    }

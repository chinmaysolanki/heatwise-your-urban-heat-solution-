"""Feasibility ML score from bundle."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from serving.loaders.load_inference_bundle import InferenceBundle
from serving.scoring.features_frame import build_frame_for_bundle, merge_snapshots_to_row


def score_feasibility(
    bundle: InferenceBundle | None,
    project: dict[str, Any],
    environment: dict[str, Any],
    preferences: dict[str, Any],
    candidate: dict[str, Any],
    species_csv: Path | None,
) -> tuple[float | None, str | None]:
    if bundle is None:
        return None, "no_bundle"
    try:
        row = merge_snapshots_to_row(project, environment, preferences, candidate)
        X = build_frame_for_bundle(row, bundle.feature_names(), species_csv)
        y = bundle.model.predict(X)
        v = float(np.asarray(y).ravel()[0])
        v = max(0.0, min(1.0, v))
        return v, None
    except Exception as e:  # noqa: BLE001
        return None, str(e)

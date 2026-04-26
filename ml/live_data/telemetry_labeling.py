"""
Canonical vs legacy recommendation telemetry for ML exports (Phase 7).

Mirrors server semantics in ``lib/recommendationTelemetryCanonical.ts``:
- Rows may store legacy ``event_type``, canonical ``event_type``, and/or
  ``metadata.canonicalEvent`` / ``metadata.legacyEventType`` (hw_telemetry_v1).

**Weight resolution order** (first match wins):
1. ``metadata.legacyEventType`` if present in the weight table — preserves
   calibrated weights when the canonical umbrella would differ (e.g.
   ``recommendation_request_regenerate`` → canonical ``candidate_dismissed`` but weight -20).
2. Stored ``event_type`` if in the weight table.
3. ``metadata.canonicalEvent`` if in the weight table.
4. ``LEGACY_TO_CANONICAL[event_type]`` then lookup (fallback).

Version bumps when weights or resolution rules change.
"""

from __future__ import annotations

import json
from typing import Any

import pandas as pd

TELEMETRY_LABELING_VERSION = "hw-telemetry-labeling-v1"
EVENT_WEIGHT_REFERENCE_VERSION = "hw-event-weights-v1"

# Keep in sync with lib/recommendationTelemetryCanonical.ts LEGACY_TO_CANONICAL
LEGACY_TO_CANONICAL: dict[str, str] = {
    "recommendation_impression": "candidate_viewed",
    "recommendation_view": "recommendation_run_viewed",
    "recommendation_expand": "candidate_viewed",
    "recommendation_compare": "candidate_viewed",
    "recommendation_select": "candidate_selected",
    "recommendation_dismiss": "candidate_dismissed",
    "recommendation_save": "candidate_viewed",
    "recommendation_unsave": "candidate_dismissed",
    "recommendation_share": "recommendation_run_viewed",
    "recommendation_request_regenerate": "candidate_dismissed",
    "recommendation_request_ar_preview": "visualization_requested",
    "recommendation_request_before_after": "visualization_requested",
    "recommendation_request_installer": "installation_request_started",
    "recommendation_feedback_positive": "candidate_rated_positive",
    "recommendation_feedback_negative": "candidate_rated_negative",
}


def parse_metadata(raw: object) -> dict[str, Any]:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return {}
        try:
            o = json.loads(s)
            return o if isinstance(o, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def effective_canonical_event(event_type: object, metadata: object) -> str:
    """Prefer persisted metadata.canonicalEvent; else map legacy event_type."""
    et = str(event_type or "").strip()
    meta = parse_metadata(metadata)
    ce = meta.get("canonicalEvent")
    if isinstance(ce, str) and ce.strip():
        return ce.strip()
    return LEGACY_TO_CANONICAL.get(et, et)


# Heuristic relevance weights (weak supervision). Tune on held-out explicit labels.
# Canonical and legacy keys both listed so old CSV rows still score without metadata.
EVENT_WEIGHT: dict[str, float] = {
    # Strong positive / selection
    "recommendation_select": 100.0,
    "candidate_selected": 100.0,
    "recommendation_save": 85.0,
    "recommendation_feedback_positive": 70.0,
    "candidate_rated_positive": 70.0,
    # Social / install intent
    "recommendation_share": 55.0,
    "recommendation_request_installer": 55.0,
    "installation_request_started": 55.0,
    "installer_export_requested": 52.0,
    # Engagement / shallow positive
    "recommendation_expand": 40.0,
    "recommendation_compare": 40.0,
    "recommendation_request_ar_preview": 30.0,
    "recommendation_request_before_after": 30.0,
    "visualization_requested": 30.0,
    "recommendation_view": 25.0,
    "recommendation_run_viewed": 25.0,
    "report_opened": 22.0,
    "recommendation_impression": 10.0,
    "candidate_viewed": 10.0,
    # Negative / friction
    "recommendation_request_regenerate": -20.0,
    "recommendation_dismiss": -35.0,
    "candidate_dismissed": -35.0,
    "recommendation_unsave": -40.0,
    "recommendation_feedback_negative": -50.0,
    "candidate_rated_negative": -50.0,
}


def event_weight_for_row(event_type: object, metadata: object) -> float:
    et = str(event_type or "").strip()
    meta = parse_metadata(metadata)
    legacy = meta.get("legacyEventType")
    if isinstance(legacy, str) and legacy in EVENT_WEIGHT:
        return float(EVENT_WEIGHT[legacy])
    if et in EVENT_WEIGHT:
        return float(EVENT_WEIGHT[et])
    canon_meta = meta.get("canonicalEvent")
    if isinstance(canon_meta, str) and canon_meta in EVENT_WEIGHT:
        return float(EVENT_WEIGHT[canon_meta])
    canon = LEGACY_TO_CANONICAL.get(et, et)
    return float(EVENT_WEIGHT.get(canon, 0.0))


def _normalize_event_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    for old, new in (
        ("sessionId", "recommendation_session_id"),
        ("candidateSnapshotId", "candidate_snapshot_id"),
        ("eventType", "event_type"),
        ("metadataJson", "metadata_json"),
        ("recommendationRunId", "recommendation_run_id"),
    ):
        if new not in out.columns and old in out.columns:
            out = out.rename(columns={old: new})
    if "metadata_json" not in out.columns and "metadata" in out.columns:
        out = out.rename(columns={"metadata": "metadata_json"})
    return out


def enrich_feedback_events_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """Add ``canonical_event``, ``learning_weight``; normalize ID/metadata column names."""
    if df.empty:
        return df
    out = _normalize_event_columns(df)
    if "event_type" not in out.columns:
        out["event_type"] = ""
    metas = out["metadata_json"] if "metadata_json" in out.columns else pd.Series([None] * len(out))
    types = out["event_type"]
    out["canonical_event"] = [effective_canonical_event(et, m) for et, m in zip(types, metas)]
    out["learning_weight"] = [event_weight_for_row(et, m) for et, m in zip(types, metas)]
    return out


def parse_species_payload_json(raw: object) -> list[str]:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return []
    if not isinstance(raw, str) or not raw.strip():
        return []
    try:
        o = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(o, dict):
        return []
    c = o.get("speciesCatalogCodes")
    if not isinstance(c, list):
        return []
    return [str(x) for x in c if x is not None and str(x).strip()]


def enrich_candidate_snapshots_species(df: pd.DataFrame) -> pd.DataFrame:
    """Add ``species_catalog_codes_joined`` (pipe-separated) from species payload JSON."""
    if df.empty:
        return df
    out = df.copy()
    col = None
    for c in ("species_payload_json", "speciesPayloadJson"):
        if c in out.columns:
            col = c
            break
    if not col:
        out["species_catalog_codes_joined"] = ""
        return out
    joined: list[str] = []
    for _, r in out.iterrows():
        codes = parse_species_payload_json(r.get(col))
        joined.append("|".join(codes))
    out["species_catalog_codes_joined"] = joined
    return out


def enrich_recommendation_sessions_run_id(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty:
        return df
    out = df.copy()
    if "legacy_recommendation_run_id" not in out.columns and "legacyRecommendationRunId" in out.columns:
        out = out.rename(columns={"legacyRecommendationRunId": "legacy_recommendation_run_id"})
    return out

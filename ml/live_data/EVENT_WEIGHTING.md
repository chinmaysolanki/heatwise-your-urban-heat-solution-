# Live telemetry — event weights for weak supervision (Phase 7)

Heuristic scores feed ``live_outcome_labels.csv`` / ranking pairs. **Not** learned weights — calibrate on held-out explicit labels before production retrains.

## Resolution order

For each row, ``telemetry_labeling.event_weight_for_row`` uses the first match:

1. ``metadata.legacyEventType`` if present in the weight table — keeps **regenerate** at −20 even though its canonical label is ``candidate_dismissed`` (−35).
2. Stored ``event_type`` if in the table.
3. ``metadata.canonicalEvent`` if in the table.
4. ``LEGACY_TO_CANONICAL[event_type]`` then lookup (same table).

Canonical names align with ``lib/recommendationTelemetryCanonical.ts``.

## Weight table (``EVENT_WEIGHT``)

| Key(s) | Weight | Notes |
|--------|--------|--------|
| ``candidate_selected``, ``recommendation_select`` | +100 | Explicit choice |
| ``recommendation_save`` | +85 | |
| ``candidate_rated_positive``, ``recommendation_feedback_positive`` | +70 | |
| ``installation_request_started``, ``recommendation_request_installer`` | +55 | Install intent |
| ``recommendation_share`` | +55 | |
| ``installer_export_requested`` | +52 | Export = strong downstream intent |
| ``recommendation_expand``, ``recommendation_compare`` | +40 | |
| ``visualization_requested``, ``recommendation_request_ar_preview``, ``recommendation_request_before_after`` | +30 | |
| ``recommendation_run_viewed``, ``recommendation_view`` | +25 | Session / run surfaced |
| ``report_opened`` | +22 | Report surface |
| ``candidate_viewed``, ``recommendation_impression`` | +10 | Shown |
| ``recommendation_request_regenerate`` | −20 | Frustration (prefer legacy metadata when mapped to dismiss) |
| ``candidate_dismissed``, ``recommendation_dismiss`` | −35 | |
| ``recommendation_unsave`` | −40 | |
| ``candidate_rated_negative``, ``recommendation_feedback_negative`` | −50 | |

Missing / unknown types → **0** (no contribution to max aggregate).

## Install outcome boost

In ``export_training_dataset._candidate_scores``, completed install with matching ``selected_candidate_snapshot_id`` adds **+120** to that candidate’s heuristic score (unchanged from v1).

## Version

Bump ``EVENT_WEIGHT_REFERENCE_VERSION`` in ``telemetry_labeling.py`` when this table changes.

from __future__ import annotations

import json
from typing import Any

USER_REPORT_VISIBILITY = frozenset({"user", "shared"})
INSTALLER_REPORT_VISIBILITY = frozenset({"installer", "shared"})
ADMIN_REPORT_VISIBILITY = frozenset({"admin", "shared"})


def filter_sections_by_visibility(
    sections: list[dict[str, Any]],
    allowed_scopes: frozenset[str],
) -> list[dict[str, Any]]:
    """Mirrors userReportService / installerSummaryService / adminReviewDossierService filters."""
    return [s for s in sections if str(s.get("visibility_scope")) in allowed_scopes]


def map_ts_dossier_row_to_canonical(row: dict[str, Any]) -> dict[str, Any]:
    """Map Prisma/API camelCase dossier export to canonical snake_case keys for CSV/JSONL."""
    cid = row.get("id") or row.get("recommendation_dossier_id")
    return {
        "recommendation_dossier_id": cid,
        "project_id": row.get("projectId") or row.get("project_id"),
        "user_id": row.get("userId") if "userId" in row else row.get("user_id"),
        "recommendation_session_id": row.get("recommendationSessionId") or row.get("recommendation_session_id"),
        "candidate_snapshot_ids_json": row.get("candidateSnapshotIdsJson") or row.get("candidate_snapshot_ids_json"),
        "selected_candidate_snapshot_id": row.get("selectedCandidateSnapshotId")
        if "selectedCandidateSnapshotId" in row
        else row.get("selected_candidate_snapshot_id"),
        "generated_at": (row.get("generatedAt") or row.get("generated_at") or "")[:32],
        "dossier_type": row.get("dossierType") or row.get("dossier_type"),
        "dossier_version": row.get("dossierVersion") or row.get("dossier_version"),
        "project_context_snapshot_json": row.get("projectContextSnapshotJson") or row.get("project_context_snapshot_json"),
        "recommendation_summary_json": row.get("recommendationSummaryJson") or row.get("recommendation_summary_json"),
        "pricing_summary_json": row.get("pricingSummaryJson") if "pricingSummaryJson" in row else row.get("pricing_summary_json"),
        "supply_summary_json": row.get("supplySummaryJson") if "supplySummaryJson" in row else row.get("supply_summary_json"),
        "personalization_summary_json": row.get("personalizationSummaryJson")
        if "personalizationSummaryJson" in row
        else row.get("personalization_summary_json"),
        "geospatial_summary_json": row.get("geospatialSummaryJson")
        if "geospatialSummaryJson" in row
        else row.get("geospatial_summary_json"),
        "feasibility_summary_json": row.get("feasibilitySummaryJson")
        if "feasibilitySummaryJson" in row
        else row.get("feasibility_summary_json"),
        "scenario_summary_json": row.get("scenarioSummaryJson")
        if "scenarioSummaryJson" in row
        else row.get("scenario_summary_json"),
        "installer_readiness_summary_json": row.get("installerReadinessSummaryJson")
        if "installerReadinessSummaryJson" in row
        else row.get("installer_readiness_summary_json"),
        "execution_notes_json": row.get("executionNotesJson") if "executionNotesJson" in row else row.get("execution_notes_json"),
        "explanation_provenance_json": row.get("explanationProvenanceJson") or row.get("explanation_provenance_json"),
        "metadata_json": row.get("metadataJson") if "metadataJson" in row else row.get("metadata_json"),
    }


def map_section_to_analytics_row(sec: dict[str, Any]) -> dict[str, Any]:
    """Presence / size signals for report_section_presence.csv."""
    payload = sec.get("section_payload_json")
    size = len(payload) if isinstance(payload, str) else 0
    depth = 0
    if isinstance(payload, str):
        try:
            obj = json.loads(payload)
            if isinstance(obj, dict):
                depth = len(obj)
        except json.JSONDecodeError:
            depth = -1
    return {
        "report_section_id": sec.get("report_section_id"),
        "recommendation_dossier_id": sec.get("recommendation_dossier_id"),
        "section_key": sec.get("section_key"),
        "section_order": sec.get("section_order"),
        "visibility_scope": sec.get("visibility_scope"),
        "payload_byte_length": size,
        "payload_top_level_keys": depth,
    }

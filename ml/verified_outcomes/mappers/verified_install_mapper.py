"""
Map DB/API-shaped records to flat training-export rows.

Compatible with hybrid / live_data / retraining CSV expectations (camelCase or snake).
"""

from __future__ import annotations

import json
from typing import Any


def prisma_verified_install_to_export_row(v: dict[str, Any]) -> dict[str, Any]:
    return {
        "verified_install_id": v.get("id"),
        "install_job_id": v.get("installJobId") or v.get("install_job_id"),
        "project_id": v.get("projectId") or v.get("project_id"),
        "installer_id": v.get("installerId") or v.get("installer_id"),
        "verified_at": v.get("verifiedAt") or v.get("verified_at"),
        "installed_solution_type": v.get("installedSolutionType") or v.get("installed_solution_type"),
        "installed_area_sqft": v.get("installedAreaSqft") or v.get("installed_area_sqft"),
        "matches_recommended_candidate": v.get("matchesRecommendedCandidate") or v.get("matches_recommended_candidate"),
        "mismatch_reason_codes_json": v.get("mismatchReasonCodesJson") or v.get("mismatch_reason_codes_json"),
        "installer_confidence_score": v.get("installerConfidenceScore") or v.get("installer_confidence_score"),
    }


def attach_candidate_snapshot_summary(
    row: dict[str, Any],
    candidate_snapshot_json: str | None,
) -> dict[str, Any]:
    out = dict(row)
    out["recommended_candidate_summary_json"] = candidate_snapshot_json or ""
    return out


def outcome_to_training_row(o: dict[str, Any]) -> dict[str, Any]:
    return {
        "outcome_verification_id": o.get("id"),
        "verified_install_id": o.get("verifiedInstallId") or o.get("verified_install_id"),
        "verification_confidence_tier": o.get("verificationConfidenceTier") or o.get("verification_confidence_tier"),
        "measured_temp_change_c": o.get("measuredTempChangeC") or o.get("measured_temp_change_c"),
        "plant_survival_rate_90d": o.get("plantSurvivalRate90d") or o.get("plant_survival_rate_90d"),
    }

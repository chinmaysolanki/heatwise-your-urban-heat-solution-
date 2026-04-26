"""Canonical mismatch reason codes (keep in sync with mismatch_reason_codes.json)."""

from __future__ import annotations

MISMATCH_REASON_CODES: frozenset[str] = frozenset(
    {
        "budget_too_high",
        "species_unavailable",
        "installer_not_confident",
        "structural_constraint_found",
        "waterproofing_issue_found",
        "irrigation_not_feasible",
        "user_changed_preference",
        "space_measurement_changed",
        "local_availability_issue",
        "maintenance_concern",
        "safety_concern",
        "weather_or_seasonality_issue",
        "compliance_or_building_rule_issue",
        "installer_better_alternative",
        "partial_install_only",
    },
)

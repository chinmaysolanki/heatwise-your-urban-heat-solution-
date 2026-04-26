"""Required section keys per dossier_type — must stay in sync with lib/reportingConstants.ts DOSSIER_SECTION_BLUEPRINTS."""

from __future__ import annotations

SECTION_KEYS: frozenset[str] = frozenset(
    {
        "project_summary",
        "space_analysis",
        "recommendation_overview",
        "candidate_breakdown",
        "cost_summary",
        "maintenance_summary",
        "cooling_impact_summary",
        "supply_constraints_summary",
        "personalization_summary",
        "geospatial_summary",
        "phased_plan_summary",
        "installer_execution_notes",
        "admin_risk_review",
        "evidence_and_confidence",
    },
)

# Exact keys present for each assembled dossier (order is enforced separately via section_order).
DOSSIER_REQUIRED_SECTION_KEYS: dict[str, frozenset[str]] = {
    "user_final_recommendation": frozenset(
        {
            "project_summary",
            "space_analysis",
            "recommendation_overview",
            "candidate_breakdown",
            "cost_summary",
            "maintenance_summary",
            "cooling_impact_summary",
            "supply_constraints_summary",
            "personalization_summary",
            "geospatial_summary",
            "phased_plan_summary",
            "evidence_and_confidence",
        },
    ),
    "installer_execution_summary": frozenset(
        {
            "project_summary",
            "recommendation_overview",
            "candidate_breakdown",
            "installer_execution_notes",
            "supply_constraints_summary",
            "maintenance_summary",
            "evidence_and_confidence",
        },
    ),
    "admin_internal_review": frozenset(
        {
            "project_summary",
            "space_analysis",
            "recommendation_overview",
            "candidate_breakdown",
            "cost_summary",
            "maintenance_summary",
            "cooling_impact_summary",
            "supply_constraints_summary",
            "personalization_summary",
            "geospatial_summary",
            "phased_plan_summary",
            "installer_execution_notes",
            "admin_risk_review",
            "evidence_and_confidence",
        },
    ),
    "scenario_comparison_pack": frozenset(
        {
            "project_summary",
            "recommendation_overview",
            "candidate_breakdown",
            "cost_summary",
            "phased_plan_summary",
            "supply_constraints_summary",
            "evidence_and_confidence",
        },
    ),
}

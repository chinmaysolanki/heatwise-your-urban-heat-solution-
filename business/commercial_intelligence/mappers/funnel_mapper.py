from __future__ import annotations

from typing import Any

FUNNEL_STAGES: list[str] = [
    "project_created",
    "recommendation_generated",
    "recommendation_saved",
    "installer_requested",
    "quote_requested",
    "quote_received",
    "quote_accepted",
    "site_visit_scheduled",
    "install_started",
    "install_completed",
    "followup_completed",
    "maintenance_plan_started",
]

FUNNEL_STAGE_ORDER: dict[str, int] = {s: i for i, s in enumerate(FUNNEL_STAGES)}


def map_funnel_event_to_row(ev: dict[str, Any]) -> dict[str, Any]:
    stage = str(ev.get("funnel_stage") or "")
    return {
        "lead_funnel_event_id": ev.get("lead_funnel_event_id"),
        "event_type": ev.get("event_type"),
        "event_timestamp": ev.get("event_timestamp"),
        "project_id": ev.get("project_id"),
        "funnel_stage": stage,
        "funnel_stage_index": FUNNEL_STAGE_ORDER.get(stage, -1),
        "region": ev.get("region"),
        "project_type": ev.get("project_type"),
        "source_channel": ev.get("source_channel"),
        "budget_band": ev.get("budget_band"),
        "installer_id": ev.get("installer_id"),
    }

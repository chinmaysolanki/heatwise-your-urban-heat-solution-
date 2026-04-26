from __future__ import annotations

from typing import Any


def map_unit_economics_snapshot_row(snap: dict[str, Any]) -> dict[str, Any]:
    """Align API/DB snapshot to export column names (snake_case)."""
    return {k: snap.get(k) for k in snap.keys()}


def map_conversion_economics_row(snap: dict[str, Any]) -> dict[str, Any]:
    """Conversion-focused subset for conversion_economics.csv."""
    return {
        "unit_economics_snapshot_id": snap.get("unit_economics_snapshot_id"),
        "window_start": snap.get("window_start"),
        "window_end": snap.get("window_end"),
        "region": snap.get("region"),
        "project_type": snap.get("project_type"),
        "source_channel": snap.get("source_channel"),
        "total_quote_requests": snap.get("total_quote_requests"),
        "total_quotes_received": snap.get("total_quotes_received"),
        "total_quote_acceptances": snap.get("total_quote_acceptances"),
        "total_installs_completed": snap.get("total_installs_completed"),
        "quote_request_to_quote_received_rate": snap.get("quote_request_to_quote_received_rate"),
        "quote_received_to_acceptance_rate": snap.get("quote_received_to_acceptance_rate"),
        "acceptance_to_install_rate": snap.get("acceptance_to_install_rate"),
        "install_conversion_rate": snap.get("install_conversion_rate"),
        "avg_time_to_quote_hours": snap.get("avg_time_to_quote_hours"),
        "avg_time_to_install_days": snap.get("avg_time_to_install_days"),
    }


def map_revenue_margin_summary_row(snap: dict[str, Any]) -> dict[str, Any]:
    return {
        "unit_economics_snapshot_id": snap.get("unit_economics_snapshot_id"),
        "window_start": snap.get("window_start"),
        "window_end": snap.get("window_end"),
        "avg_revenue_per_project_inr": snap.get("avg_revenue_per_project_inr"),
        "avg_revenue_per_install_inr": snap.get("avg_revenue_per_install_inr"),
        "avg_platform_margin_inr": snap.get("avg_platform_margin_inr"),
        "avg_quote_value_inr": snap.get("avg_quote_value_inr"),
        "avg_final_install_value_inr": snap.get("avg_final_install_value_inr"),
        "refund_rate": snap.get("refund_rate"),
        "repeat_service_rate": snap.get("repeat_service_rate"),
    }

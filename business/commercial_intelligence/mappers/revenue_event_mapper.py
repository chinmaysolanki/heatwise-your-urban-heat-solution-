from __future__ import annotations

from typing import Any


def map_revenue_event_to_row(ev: dict[str, Any]) -> dict[str, Any]:
    """Single flat row for revenue_events.csv."""
    return {
        "revenue_event_id": ev.get("revenue_event_id"),
        "event_type": ev.get("event_type"),
        "event_timestamp": ev.get("event_timestamp"),
        "currency": ev.get("currency"),
        "revenue_status": ev.get("revenue_status"),
        "revenue_source": ev.get("revenue_source"),
        "project_id": ev.get("project_id"),
        "user_id": ev.get("user_id"),
        "installer_id": ev.get("installer_id"),
        "gross_amount": ev.get("gross_amount"),
        "net_amount": ev.get("net_amount"),
        "commission_amount": ev.get("commission_amount"),
        "platform_fee_amount": ev.get("platform_fee_amount"),
        "discount_amount": ev.get("discount_amount"),
        "refund_amount": ev.get("refund_amount"),
        "tax_amount": ev.get("tax_amount"),
    }


def revenue_breakdown_lines(ev: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalized fee lines for revenue_event_breakdowns.csv."""
    rid = ev.get("revenue_event_id")
    rows: list[dict[str, Any]] = []
    mapping = [
        ("gross", ev.get("gross_amount")),
        ("net", ev.get("net_amount")),
        ("commission", ev.get("commission_amount")),
        ("platform_fee", ev.get("platform_fee_amount")),
        ("discount", ev.get("discount_amount")),
        ("refund", ev.get("refund_amount")),
        ("tax", ev.get("tax_amount")),
    ]
    for component, amt in mapping:
        if amt is None:
            continue
        rows.append(
            {
                "revenue_event_id": rid,
                "component": component,
                "amount": amt,
                "currency": ev.get("currency"),
            },
        )
    return rows


def flatten_revenue_breakdowns(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for ev in events:
        out.extend(revenue_breakdown_lines(ev))
    return out

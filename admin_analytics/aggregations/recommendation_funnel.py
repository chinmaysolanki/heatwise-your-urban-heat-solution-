"""
Aggregate recommendation funnel from exported row dicts.

Row shapes (align with Prisma / TS telemetry):
- ``sessions``: ``{ "id", "generatedAt" }`` (optional window filter applied by exporter)
- ``events``: ``{ "sessionId", "eventType", "eventTimestamp" }``
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

IMPRESSION_TYPES = frozenset({"recommendation_impression", "recommendation_view", "candidate_viewed"})
SELECT_TYPES = frozenset({"recommendation_select", "candidate_selected"})


def aggregate_recommendation_funnel(
    sessions: list[dict[str, Any]],
    events: list[dict[str, Any]],
    install_completed_count: int,
) -> dict[str, Any]:
    sessions_generated = len(sessions)
    by_session: dict[str, set[str]] = defaultdict(set)
    event_type_counts: dict[str, int] = defaultdict(int)

    for ev in events:
        sid = str(ev.get("sessionId") or "")
        et = str(ev.get("eventType") or "")
        if not sid:
            continue
        by_session[sid].add(et)
        event_type_counts[et] += 1

    def count_sessions_with(predicate) -> int:
        return sum(1 for types in by_session.values() if predicate(types))

    impression = count_sessions_with(lambda t: bool(t & IMPRESSION_TYPES))
    expand = count_sessions_with(lambda t: "recommendation_expand" in t)
    save = count_sessions_with(lambda t: "recommendation_save" in t)
    select = count_sessions_with(lambda t: bool(t & SELECT_TYPES))
    installer = count_sessions_with(lambda t: "recommendation_request_installer" in t)

    unique_sessions = {
        "sessions_generated": sessions_generated,
        "impression": impression,
        "expand": expand,
        "save": save,
        "select": select,
        "installer_request": installer,
        "install_completed": int(install_completed_count),
    }

    def div(a: float, b: float) -> float | None:
        return a / b if b > 0 else None

    rates_vs_impression = {
        "impression_rate": div(impression, sessions_generated),
        "expand_rate": div(expand, impression),
        "save_rate": div(save, impression),
        "select_rate": div(select, impression),
        "installer_request_rate": div(installer, impression),
        "install_completion_rate": div(install_completed_count, impression),
    }
    rates_vs_sessions = {
        "impression_rate": div(impression, sessions_generated),
        "expand_rate": div(expand, sessions_generated),
        "save_rate": div(save, sessions_generated),
        "select_rate": div(select, sessions_generated),
        "installer_request_rate": div(installer, sessions_generated),
        "install_completed_rate": div(install_completed_count, sessions_generated),
    }

    return {
        "unique_sessions": unique_sessions,
        "rates_vs_impression": rates_vs_impression,
        "rates_vs_sessions": rates_vs_sessions,
        "event_type_counts": dict(event_type_counts),
    }

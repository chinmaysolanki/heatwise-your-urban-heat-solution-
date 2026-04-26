"""
Cohort slicing from session snapshot JSON strings (same keys as TS ``extractCohortFromSessionSnapshots``).
"""

from __future__ import annotations

import json
from collections import defaultdict
from typing import Any


def _safe_json(s: str | None) -> dict[str, Any]:
    if not s:
        return {}
    try:
        o = json.loads(s)
        return o if isinstance(o, dict) else {}
    except json.JSONDecodeError:
        return {}


def extract_cohort(
    project_snapshot_json: str,
    preference_snapshot_json: str,
    environment_snapshot_json: str,
) -> dict[str, str]:
    project = _safe_json(project_snapshot_json)
    pref = _safe_json(preference_snapshot_json)
    env = _safe_json(environment_snapshot_json)

    project_type = str(
        project.get("projectType")
        or project.get("type")
        or project.get("spaceType")
        or project.get("project_type")
        or "unknown",
    )
    climate_zone = str(
        env.get("climateZone")
        or env.get("climate_zone")
        or project.get("climateZone")
        or project.get("climate_zone")
        or "unknown",
    )

    br = pref.get("budgetRange") or project.get("budgetRange")
    if isinstance(br, str) and br.strip():
        budget_band = br.strip().lower()
    else:
        inr = float(pref.get("budget_inr") or project.get("budget_inr") or 0)
        if inr > 0:
            if inr < 50_000:
                budget_band = "low_inr"
            elif inr < 150_000:
                budget_band = "medium_inr"
            else:
                budget_band = "high_inr"
        else:
            budget_band = "unspecified"

    return {
        "project_type": project_type or "unknown",
        "climate_zone": climate_zone or "unknown",
        "budget_band": budget_band,
    }


def aggregate_cohort_metrics(
    events: list[dict[str, Any]],
    install_completed_by_cohort: dict[str, int] | None = None,
) -> list[dict[str, Any]]:
    """
    ``events`` rows: sessionId, eventType, projectSnapshotJson, preferenceSnapshotJson, environmentSnapshotJson
    (exporter should join session snapshots onto each event or pass pre-joined dicts).
    """
    install_completed_by_cohort = install_completed_by_cohort or {}
    session_types: dict[str, set[str]] = defaultdict(set)
    cohort_by_session: dict[str, dict[str, str]] = {}

    for ev in events:
        sid = str(ev.get("sessionId") or "")
        if not sid:
            continue
        et = str(ev.get("eventType") or "")
        session_types[sid].add(et)
        if sid not in cohort_by_session:
            cohort_by_session[sid] = extract_cohort(
                str(ev.get("projectSnapshotJson") or ""),
                str(ev.get("preferenceSnapshotJson") or ""),
                str(ev.get("environmentSnapshotJson") or ""),
            )

    def cohort_key(c: dict[str, str]) -> str:
        return f"{c['project_type']}\t{c['climate_zone']}\t{c['budget_band']}"

    agg: dict[str, dict[str, Any]] = {}
    for sid, types in session_types.items():
        c = cohort_by_session[sid]
        key = cohort_key(c)
        if key not in agg:
            agg[key] = {
                **c,
                "sessions": set(),
                "impressions": 0,
                "selects": 0,
                "installer_requests": 0,
            }
        row = agg[key]
        row["sessions"].add(sid)
        if types & {"recommendation_impression", "recommendation_view", "candidate_viewed"}:
            row["impressions"] += 1
        if types & {"recommendation_select", "candidate_selected"}:
            row["selects"] += 1
        if "recommendation_request_installer" in types:
            row["installer_requests"] += 1

    out = []
    for key, row in agg.items():
        c = {k: row[k] for k in ("project_type", "climate_zone", "budget_band")}
        out.append(
            {
                **c,
                "sessions": len(row["sessions"]),
                "impressions": row["impressions"],
                "selects": row["selects"],
                "installer_requests": row["installer_requests"],
                "installs_completed": install_completed_by_cohort.get(key, 0),
            },
        )
    out.sort(key=lambda r: -r["sessions"])
    return out

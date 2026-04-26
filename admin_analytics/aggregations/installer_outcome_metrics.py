"""Install outcome aggregates from ``InstallOutcomeRecord``-shaped dicts."""

from __future__ import annotations

from typing import Any


def aggregate_installer_outcomes(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_status: dict[str, int] = {}
    sat: list[float] = []
    feas: list[float] = []
    temp: list[float] = []
    p30: list[float] = []
    p90: list[float] = []

    for r in rows:
        st = str(r.get("installStatus") or "unknown")
        by_status[st] = by_status.get(st, 0) + 1
        if r.get("userSatisfactionScore") is not None:
            sat.append(float(r["userSatisfactionScore"]))
        if r.get("installerFeasibilityRating") is not None:
            feas.append(float(r["installerFeasibilityRating"]))
        if r.get("measuredTempChangeC") is not None:
            temp.append(float(r["measuredTempChangeC"]))
        if r.get("plantSurvivalRate30d") is not None:
            p30.append(float(r["plantSurvivalRate30d"]))
        if r.get("plantSurvivalRate90d") is not None:
            p90.append(float(r["plantSurvivalRate90d"]))

    def avg(xs: list[float]) -> float | None:
        return sum(xs) / len(xs) if xs else None

    return {
        "by_status": by_status,
        "completed_count": by_status.get("completed", 0),
        "avg_user_satisfaction": avg(sat),
        "avg_installer_feasibility": avg(feas),
        "avg_measured_temp_change_c": avg(temp),
        "avg_plant_survival_30d": avg(p30),
        "avg_plant_survival_90d": avg(p90),
    }

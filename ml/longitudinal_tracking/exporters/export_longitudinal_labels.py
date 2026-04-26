#!/usr/bin/env python3
"""
Build time-windowed longitudinal training labels from a JSON bundle.

**Explicit rules (v1)**

- ``survival_trend``: Compare ordered windows (7d → 30d → 90d → 180d). If <2 points → ``insufficient_data``.
  If last − first ≤ −0.15 → ``declining``; if last − first ≥ 0.05 → ``improving``; else ``stable``.

- ``satisfaction_trend``: Same deltas on 0–5 satisfaction (thresholds: decline if ≤−1.0, improve if ≥0.5).

- ``maintenance_adherence_trend``: Same on 0–1 adherence (decline ≤−0.2, improve ≥0.1).

- ``delayed_failure_indicator``: True if plant survival at 30d ≥ 0.8 and at 90d < 0.5 (both present).

- ``long_term_heat_mitigation_stability``: If ≥2 ``heat_mitigation_stability_score`` values, stdev ≤0.12 → ``stable``,
  stdev ≤0.25 → ``moderate``, else ``volatile``. If <2 points → ``insufficient_data``.

Input bundle keys: ``schedules``, ``checkpoints``, ``events`` (optional), ``remeasurements``.
Each list contains Prisma-style dicts (camelCase) or snake_case.

Usage::
  PYTHONPATH=ml python -m longitudinal_tracking.exporters.export_longitudinal_labels bundle.json -o out_dir
"""

from __future__ import annotations

import argparse
import csv
import json
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any


WINDOW_ORDER = ["7d", "30d", "90d", "180d"]


def _pick(d: dict[str, Any], *keys: str) -> Any:
    for k in keys:
        if k in d and d[k] is not None:
            return d[k]
    return None


def _latest_by_window(rows: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Latest remeasurement per window_label by measuredAt."""
    by_w: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in rows:
        wl = str(_pick(r, "windowLabel", "window_label") or "")
        if wl:
            by_w[wl].append(r)
    out: dict[str, dict[str, Any]] = {}
    for wl, lst in by_w.items():
        lst.sort(key=lambda x: str(_pick(x, "measuredAt", "measured_at") or ""))
        out[wl] = lst[-1]
    return out


def _series_float(by_window: dict[str, dict[str, Any]], *keys: str) -> list[tuple[str, float]]:
    pts: list[tuple[str, float]] = []
    for wl in WINDOW_ORDER:
        if wl not in by_window:
            continue
        r = by_window[wl]
        v = _pick(r, *keys)
        if v is None:
            continue
        try:
            pts.append((wl, float(v)))
        except (TypeError, ValueError):
            continue
    return pts


def _trend_label(pts: list[tuple[str, float]], *, decline_th: float, improve_th: float) -> str:
    if len(pts) < 2:
        return "insufficient_data"
    first, last = pts[0][1], pts[-1][1]
    delta = last - first
    if delta <= decline_th:
        return "declining"
    if delta >= improve_th:
        return "improving"
    return "stable"


def _delayed_failure(by_window: dict[str, dict[str, Any]]) -> bool:
    r30 = by_window.get("30d")
    r90 = by_window.get("90d")
    if not r30 or not r90:
        return False
    try:
        s30 = float(_pick(r30, "plantSurvivalRate", "plant_survival_rate") or -1)
        s90 = float(_pick(r90, "plantSurvivalRate", "plant_survival_rate") or -1)
    except (TypeError, ValueError):
        return False
    return s30 >= 0.8 and s90 < 0.5


def _heat_stability(by_window: dict[str, dict[str, Any]]) -> str:
    vals: list[float] = []
    for wl in WINDOW_ORDER:
        r = by_window.get(wl)
        if not r:
            continue
        v = _pick(r, "heatMitigationStabilityScore", "heat_mitigation_stability_score")
        if v is None:
            continue
        try:
            vals.append(float(v))
        except (TypeError, ValueError):
            continue
    if len(vals) < 2:
        return "insufficient_data"
    sd = statistics.pstdev(vals)
    if sd <= 0.12:
        return "stable"
    if sd <= 0.25:
        return "moderate"
    return "volatile"


def build_labels_for_schedule(
    schedule_id: str,
    project_id: str,
    remeasurements: list[dict[str, Any]],
) -> dict[str, Any]:
    by_window = _latest_by_window(remeasurements)

    surv = _series_float(by_window, "plantSurvivalRate", "plant_survival_rate")
    sat = _series_float(by_window, "userSatisfactionScore", "user_satisfaction_score")
    maint = _series_float(by_window, "maintenanceAdherenceScore", "maintenance_adherence_score")

    return {
        "followup_schedule_id": schedule_id,
        "project_id": project_id,
        "n_windows_with_remeasurement": len(by_window),
        "survival_trend": _trend_label(surv, decline_th=-0.15, improve_th=0.05),
        "satisfaction_trend": _trend_label(sat, decline_th=-1.0, improve_th=0.5),
        "maintenance_adherence_trend": _trend_label(maint, decline_th=-0.2, improve_th=0.1),
        "delayed_failure_indicator": _delayed_failure(by_window),
        "long_term_heat_mitigation_stability": _heat_stability(by_window),
        "longitudinal_label_rules_version": "longitudinal.v1",
    }


def run(bundle: dict[str, Any], out_dir: Path) -> None:
    schedules = list(bundle.get("schedules") or [])
    remeas = list(bundle.get("remeasurements") or [])

    by_sched: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for r in remeas:
        sid = str(_pick(r, "scheduleId", "schedule_id") or "")
        if sid:
            by_sched[sid].append(r)

    sched_by_id = {str(_pick(s, "id")): s for s in schedules if _pick(s, "id")}

    rows = []
    for sid, rs in by_sched.items():
        sch = sched_by_id.get(sid, {})
        pid = str(_pick(sch, "projectId", "project_id") or _pick(rs[0], "projectId", "project_id") or "")
        rows.append(build_labels_for_schedule(sid, pid, rs))

    for s in schedules:
        sid = str(_pick(s, "id") or "")
        if sid and sid not in by_sched:
            pid = str(_pick(s, "projectId", "project_id") or "")
            rows.append(build_labels_for_schedule(sid, pid, []))

    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / "longitudinal_training_labels.csv"
    if not rows:
        rows.append(
            {
                "followup_schedule_id": "",
                "project_id": "",
                "n_windows_with_remeasurement": 0,
                "survival_trend": "insufficient_data",
                "satisfaction_trend": "insufficient_data",
                "maintenance_adherence_trend": "insufficient_data",
                "delayed_failure_indicator": False,
                "long_term_heat_mitigation_stability": "insufficient_data",
                "longitudinal_label_rules_version": "longitudinal.v1",
            },
        )

    headers = list(rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for r in rows:
            w.writerow({k: json.dumps(v) if isinstance(v, bool) else v for k, v in r.items()})


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("bundle_json", type=Path)
    ap.add_argument("-o", "--out-dir", type=Path, required=True)
    args = ap.parse_args()
    bundle = json.loads(args.bundle_json.read_text(encoding="utf-8"))
    run(bundle, args.out_dir)


if __name__ == "__main__":
    main()

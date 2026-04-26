#!/usr/bin/env python3
"""
Build admin-metrics JSON from an on-disk export bundle (for BI / offline parity with TS aggregations).

Input JSON schema (minimal)::

    {
      "sessions": [ { "id", "generatorSource", "rulesVersion", "latencyMs",
                      "projectSnapshotJson", "preferenceSnapshotJson", "environmentSnapshotJson" } ],
      "events": [ { "sessionId", "eventType", "eventTimestamp" } ],
      "install_outcomes": [ { "installStatus", "userSatisfactionScore", ... } ]
    }

Events for cohort aggregation should include snapshot fields on each row OR duplicate session rows
(see ``aggregate_cohort_metrics``).

Usage::

    python -m admin_analytics.exporters.export_admin_metrics export_bundle.json -o admin_metrics.json
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from admin_analytics.aggregations.cohort_metrics import aggregate_cohort_metrics
from admin_analytics.aggregations.experiment_metrics import aggregate_experiment_metrics
from admin_analytics.aggregations.installer_outcome_metrics import aggregate_installer_outcomes
from admin_analytics.aggregations.recommendation_funnel import aggregate_recommendation_funnel


def _events_by_session(events: list[dict[str, Any]]) -> dict[str, dict[str, int]]:
    m: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for ev in events:
        sid = str(ev.get("sessionId") or "")
        et = str(ev.get("eventType") or "")
        if sid and et:
            m[sid][et] += 1
    return {k: dict(v) for k, v in m.items()}


def _enrich_events_with_session_snapshots(
    sessions: list[dict[str, Any]],
    events: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    snap = {
        str(s["id"]): {
            "projectSnapshotJson": s.get("projectSnapshotJson", ""),
            "preferenceSnapshotJson": s.get("preferenceSnapshotJson", ""),
            "environmentSnapshotJson": s.get("environmentSnapshotJson", ""),
        }
        for s in sessions
        if s.get("id")
    }
    out = []
    for ev in events:
        e = dict(ev)
        sid = str(e.get("sessionId") or "")
        if sid in snap:
            e.update(snap[sid])
        out.append(e)
    return out


def build_export(bundle: dict[str, Any]) -> dict[str, Any]:
    sessions = list(bundle.get("sessions") or [])
    events = list(bundle.get("events") or [])
    outcomes = list(bundle.get("install_outcomes") or [])

    completed = sum(1 for r in outcomes if str(r.get("installStatus")) == "completed")

    funnel = aggregate_recommendation_funnel(sessions, events, completed)
    installer = aggregate_installer_outcomes(outcomes)
    exp = aggregate_experiment_metrics(sessions, _events_by_session(events))
    cohort_events = _enrich_events_with_session_snapshots(sessions, events)
    cohorts = aggregate_cohort_metrics(cohort_events)

    return {
        "schema_version": "admin_metrics.v1",
        "export_ready": True,
        "recommendation_funnel": funnel,
        "installer_outcomes": installer,
        "experiment_summary": exp,
        "cohort_metrics": cohorts,
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="Aggregate HeatWise admin metrics from JSON export bundle")
    ap.add_argument("bundle_json", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=None)
    args = ap.parse_args()

    bundle = json.loads(args.bundle_json.read_text(encoding="utf-8"))
    out = build_export(bundle)
    text = json.dumps(out, indent=2)
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()

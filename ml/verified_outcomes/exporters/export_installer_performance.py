#!/usr/bin/env python3
"""
Descriptive installer performance metrics (not a ranking policy).

Input bundle JSON::
  ``installer_profiles``, ``assignments``, ``quotes``, ``install_jobs``,
  ``verified_installs``, ``outcome_verifications``

Outputs CSVs under ``-o``:
  installer_job_metrics.csv
  installer_quote_metrics.csv
  installer_alignment_metrics.csv
  installer_outcome_metrics.csv

These are **signals** for later governance — not automatic promotion/demotion of installers.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path
from typing import Any


def _write_csv(path: Path, headers: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            flat = {}
            for k, v in r.items():
                if isinstance(v, (dict, list)):
                    flat[k] = json.dumps(v)
                else:
                    flat[k] = v
            w.writerow(flat)


def run(bundle: dict[str, Any], out_dir: Path) -> None:
    profiles = list(bundle.get("installer_profiles") or [])
    assignments = list(bundle.get("assignments") or [])
    quotes = list(bundle.get("quotes") or [])
    jobs = list(bundle.get("install_jobs") or [])
    vis = list(bundle.get("verified_installs") or [])
    ovs = list(bundle.get("outcome_verifications") or [])

    by_inst: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            "quotes_submitted": 0,
            "quotes_accepted": 0,
            "assignments": 0,
            "assignments_declined": 0,
            "jobs_completed": 0,
            "jobs_cancelled": 0,
            "mismatch_count": 0,
            "verified_count": 0,
            "satisfaction_sum": 0.0,
            "satisfaction_n": 0,
        },
    )

    for a in assignments:
        iid = str(a.get("installerId") or a.get("installer_id") or "")
        if not iid:
            continue
        by_inst[iid]["assignments"] += 1
        st = str(a.get("assignmentStatus") or a.get("assignment_status") or "")
        if st == "declined":
            by_inst[iid]["assignments_declined"] += 1

    for q in quotes:
        iid = str(q.get("installerId") or q.get("installer_id") or "")
        if not iid:
            continue
        by_inst[iid]["quotes_submitted"] += 1
        if str(q.get("quoteStatus") or q.get("quote_status")) == "accepted":
            by_inst[iid]["quotes_accepted"] += 1

    for j in jobs:
        iid = str(j.get("installerId") or j.get("installer_id") or "")
        if not iid:
            continue
        st = str(j.get("jobStatus") or j.get("job_status") or "")
        if st == "completed":
            by_inst[iid]["jobs_completed"] += 1
        if st == "cancelled":
            by_inst[iid]["jobs_cancelled"] += 1

    for v in vis:
        iid = str(v.get("installerId") or v.get("installer_id") or "")
        if not iid:
            continue
        by_inst[iid]["verified_count"] += 1
        m = v.get("matchesRecommendedCandidate") or v.get("matches_recommended_candidate")
        if not m:
            by_inst[iid]["mismatch_count"] += 1

    vi_by_id = {str(v.get("id")): v for v in vis}
    for o in ovs:
        vid = str(o.get("verifiedInstallId") or o.get("verified_install_id") or "")
        vi = vi_by_id.get(vid)
        if not vi:
            continue
        iid = str(vi.get("installerId") or vi.get("installer_id") or "")
        sat = o.get("userSatisfactionScore") or o.get("user_satisfaction_score")
        if sat is not None:
            by_inst[iid]["satisfaction_sum"] += float(sat)
            by_inst[iid]["satisfaction_n"] += 1

    job_rows = []
    quote_rows = []
    align_rows = []
    outcome_rows = []
    for p in profiles:
        iid = str(p.get("id"))
        m = by_inst[iid]
        qa = m["quotes_submitted"]
        job_rows.append(
            {
                "installer_id": iid,
                "jobs_completed": m["jobs_completed"],
                "jobs_cancelled": m["jobs_cancelled"],
                "completion_rate": m["jobs_completed"] / max(1, m["jobs_completed"] + m["jobs_cancelled"]),
            },
        )
        quote_rows.append(
            {
                "installer_id": iid,
                "quotes_submitted": qa,
                "quotes_accepted": m["quotes_accepted"],
                "quote_acceptance_rate": m["quotes_accepted"] / max(1, qa),
                "assignments": m["assignments"],
                "decline_rate": m["assignments_declined"] / max(1, m["assignments"]),
            },
        )
        align_rows.append(
            {
                "installer_id": iid,
                "verified_installs": m["verified_count"],
                "mismatch_frequency": m["mismatch_count"] / max(1, m["verified_count"]),
                "service_regions": p.get("serviceRegionsJson") or p.get("service_regions_json"),
            },
        )
        outcome_rows.append(
            {
                "installer_id": iid,
                "avg_user_satisfaction": m["satisfaction_sum"] / max(1, m["satisfaction_n"]),
                "outcome_samples": m["satisfaction_n"],
            },
        )

    _write_csv(
        out_dir / "installer_job_metrics.csv",
        ["installer_id", "jobs_completed", "jobs_cancelled", "completion_rate"],
        job_rows,
    )
    _write_csv(
        out_dir / "installer_quote_metrics.csv",
        [
            "installer_id",
            "quotes_submitted",
            "quotes_accepted",
            "quote_acceptance_rate",
            "assignments",
            "decline_rate",
        ],
        quote_rows,
    )
    _write_csv(
        out_dir / "installer_alignment_metrics.csv",
        ["installer_id", "verified_installs", "mismatch_frequency", "service_regions"],
        align_rows,
    )
    _write_csv(
        out_dir / "installer_outcome_metrics.csv",
        ["installer_id", "avg_user_satisfaction", "outcome_samples"],
        outcome_rows,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("bundle_json", type=Path)
    ap.add_argument("-o", "--out-dir", type=Path, required=True)
    args = ap.parse_args()
    bundle = json.loads(args.bundle_json.read_text(encoding="utf-8"))
    run(bundle, args.out_dir)


if __name__ == "__main__":
    main()

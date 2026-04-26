#!/usr/bin/env python3
"""
Export verified installs, outcome verifications, derived labels, and rec-vs-install diff.

Input: JSON file with keys ``verified_installs``, ``outcome_verifications``, ``install_jobs``, ``quotes`` (lists of dicts).

Usage::
  PYTHONPATH=ml python -m verified_outcomes.exporters.export_verified_training_labels bundle.json -o ./out/
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any

from verified_outcomes.mappers.outcome_label_mapper import build_verified_labels
from verified_outcomes.mappers.verified_install_mapper import prisma_verified_install_to_export_row


def _write_csv(path: Path, headers: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        w.writeheader()
        for r in rows:
            w.writerow({k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in r.items()})


def run(bundle: dict[str, Any], out_dir: Path) -> None:
    vis = list(bundle.get("verified_installs") or [])
    ovs = list(bundle.get("outcome_verifications") or [])
    jobs = {str(j.get("id")): j for j in bundle.get("install_jobs") or []}
    quotes = {str(q.get("id")): q for q in bundle.get("quotes") or []}

    vi_headers = [
        "verified_install_id",
        "install_job_id",
        "project_id",
        "installer_id",
        "verified_at",
        "installed_solution_type",
        "installed_area_sqft",
        "matches_recommended_candidate",
        "mismatch_reason_codes_json",
        "installer_confidence_score",
    ]
    vi_rows = [prisma_verified_install_to_export_row(v) for v in vis]
    _write_csv(out_dir / "verified_installs.csv", vi_headers, vi_rows)

    ov_headers = [
        "outcome_verification_id",
        "verified_install_id",
        "project_id",
        "verification_confidence_tier",
        "measured_temp_change_c",
        "user_satisfaction_score",
        "plant_survival_rate_90d",
    ]
    ov_rows = []
    for o in ovs:
        ov_rows.append(
            {
                "outcome_verification_id": o.get("id"),
                "verified_install_id": o.get("verifiedInstallId") or o.get("verified_install_id"),
                "project_id": o.get("projectId") or o.get("project_id"),
                "verification_confidence_tier": o.get("verificationConfidenceTier"),
                "measured_temp_change_c": o.get("measuredTempChangeC"),
                "user_satisfaction_score": o.get("userSatisfactionScore"),
                "plant_survival_rate_90d": o.get("plantSurvivalRate90d"),
            },
        )
    _write_csv(out_dir / "outcome_verifications.csv", ov_headers, ov_rows)

    label_headers = [
        "verified_install_id",
        "install_job_id",
        "source_confidence_tier",
        *[
            "verified_install_match_label",
            "recommendation_execution_success_label",
            "real_heat_mitigation_label",
            "real_feasibility_label",
            "cost_accuracy_label",
            "maintenance_fit_label",
            "survival_success_label",
            "installer_alignment_label",
            "label_rules_version",
        ],
    ]
    ov_by_vi = {}
    for o in ovs:
        vid = o.get("verifiedInstallId") or o.get("verified_install_id")
        if vid:
            ov_by_vi[str(vid)] = o

    label_rows = []
    for v in vis:
        jid = str(v.get("installJobId") or v.get("install_job_id") or "")
        job = jobs.get(jid, {})
        qid = str(job.get("sourceQuoteId") or job.get("source_quote_id") or "")
        quote = quotes.get(qid) if qid else None
        o = ov_by_vi.get(str(v.get("id")), None)
        labels = build_verified_labels(job=job, verified_install=v, outcome=o, quote=quote)
        tier = (o or {}).get("verificationConfidenceTier") or (o or {}).get("verification_confidence_tier") or "none"
        label_rows.append(
            {
                "verified_install_id": v.get("id"),
                "install_job_id": jid,
                "source_confidence_tier": tier,
                **labels,
            },
        )
    _write_csv(out_dir / "verified_labels.csv", label_headers, label_rows)

    diff_headers = ["verified_install_id", "matches_recommended_candidate", "mismatch_reason_codes_json", "notes"]
    diff_rows = [
        {
            "verified_install_id": v.get("id"),
            "matches_recommended_candidate": v.get("matchesRecommendedCandidate") or v.get("matches_recommended_candidate"),
            "mismatch_reason_codes_json": v.get("mismatchReasonCodesJson") or v.get("mismatch_reason_codes_json"),
            "notes": v.get("notes"),
        }
        for v in vis
    ]
    _write_csv(out_dir / "recommendation_vs_install_diff.csv", diff_headers, diff_rows)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("bundle_json", type=Path)
    ap.add_argument("-o", "--out-dir", type=Path, required=True)
    args = ap.parse_args()
    bundle = json.loads(args.bundle_json.read_text(encoding="utf-8"))
    run(bundle, args.out_dir)


if __name__ == "__main__":
    main()

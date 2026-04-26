#!/usr/bin/env python3
"""
Input JSONL: each line { "cohort_summary": {...}, "retention": {...}, "region_channel": {...} }
or a single combined cohort row under "cohort".

Outputs:
  cohort_summary.csv
  cohort_retention_or_repeat_service.csv
  region_channel_projecttype_cohorts.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from commercial_intelligence.exporters._csv_util import write_csv


def _iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--out-dir", type=Path, required=True)
    args = ap.parse_args()

    summaries: list[dict[str, Any]] = []
    retention: list[dict[str, Any]] = []
    rcp: list[dict[str, Any]] = []

    for rec in _iter_jsonl(args.input):
        if rec.get("cohort_summary"):
            summaries.append(rec["cohort_summary"])
        elif rec.get("cohort"):
            summaries.append(rec["cohort"])
        if rec.get("retention"):
            retention.append(rec["retention"])
        elif rec.get("cohort"):
            retention.append(
                {
                    "cohort_label": rec["cohort"].get("cohort_label"),
                    "repeat_or_renewal_count": rec["cohort"].get("repeat_or_renewal_count"),
                    "project_count": rec["cohort"].get("project_count"),
                },
            )
        if rec.get("region_channel"):
            rcp.append(rec["region_channel"])
        elif rec.get("cohort"):
            rcp.append(
                {
                    "cohort_label": rec["cohort"].get("cohort_label"),
                    "region": rec["cohort"].get("region"),
                    "source_channel": rec["cohort"].get("source_channel"),
                    "project_type": rec["cohort"].get("project_type"),
                    "project_count": rec["cohort"].get("project_count"),
                    "install_count": rec["cohort"].get("install_count"),
                    "revenue_inr": rec["cohort"].get("revenue_inr"),
                },
            )

    write_csv(args.out_dir / "cohort_summary.csv", summaries)
    write_csv(args.out_dir / "cohort_retention_or_repeat_service.csv", retention)
    write_csv(args.out_dir / "region_channel_projecttype_cohorts.csv", rcp)
    print(f"Wrote cohort CSVs ({len(summaries)} summary rows)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

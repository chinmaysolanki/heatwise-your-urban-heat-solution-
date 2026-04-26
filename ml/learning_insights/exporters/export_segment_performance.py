#!/usr/bin/env python3
"""
JSONL: each line { "segments": [ { segment_key, project_type, ... metrics } ] }

Output: segment_performance_export.csv (flattened metrics_* columns)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterator

from learning_insights.exporters._csv_util import write_csv


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

    flat: list[dict[str, Any]] = []
    for rec in _iter_jsonl(args.input):
        for s in rec.get("segments") or []:
            metrics = s.get("metrics") or {}
            flat.append(
                {
                    "segment_key": s.get("segment_key"),
                    "project_type": s.get("project_type") or s.get("projectType"),
                    "climate_zone": s.get("climate_zone") or s.get("climateZone"),
                    "budget_band": s.get("budget_band") or s.get("budgetBand"),
                    "region": s.get("region"),
                    "user_type": s.get("user_type") or s.get("userType"),
                    "installer_availability_band": s.get("installer_availability_band")
                    or s.get("installerAvailabilityBand"),
                    "personalization_confidence_band": s.get("personalization_confidence_band")
                    or s.get("personalizationConfidenceBand"),
                    "sample_size": s.get("sample_size") or s.get("sampleSize"),
                    "metric_session_count": metrics.get("session_count"),
                    "metric_avg_candidate_score": metrics.get("avg_candidate_score"),
                    "metric_avg_feasibility_score": metrics.get("avg_feasibility_score"),
                },
            )

    write_csv(args.out_dir / "segment_performance_export.csv", flat)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

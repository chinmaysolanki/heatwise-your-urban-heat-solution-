#!/usr/bin/env python3
"""
Export constraint-impact training rows from JSONL of recommendation_constraint_snapshot records.

Example:
  PYTHONPATH=ml python -m supply_intelligence.exporters.export_constraint_impact_dataset \\
    --snapshots ml/supply_intelligence/tests/fixtures/snapshots.jsonl
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from supply_intelligence.mappers.availability_constraint_mapper import map_constraint_snapshot_to_training_row


def _iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def main() -> int:
    ap = argparse.ArgumentParser(description="Export constraint impact dataset (CSV to stdout).")
    ap.add_argument("--snapshots", type=Path, required=True, help="JSONL constraint snapshots")
    args = ap.parse_args()

    out_rows: list[dict[str, Any]] = []
    for snap in _iter_jsonl(args.snapshots):
        flat = map_constraint_snapshot_to_training_row(snap)
        flat["project_id"] = snap.get("project_id")
        flat["recommendation_session_id"] = snap.get("recommendation_session_id")
        flat["region"] = snap.get("region")
        flat["month_of_year"] = snap.get("month_of_year")
        out_rows.append(flat)

    if not out_rows:
        return 0
    w = csv.DictWriter(sys.stdout, fieldnames=sorted({k for r in out_rows for k in r.keys()}))
    w.writeheader()
    for r in out_rows:
        w.writerow({k: r.get(k, "") for k in w.fieldnames})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

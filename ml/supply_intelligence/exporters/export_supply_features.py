#!/usr/bin/env python3
"""
Emit ML-ready supply + seasonal feature rows from JSONL inputs.

Example:
  PYTHONPATH=ml python -m supply_intelligence.exporters.export_supply_features \\
    --species ml/supply_intelligence/tests/fixtures/species.jsonl \\
    --readiness ml/supply_intelligence/tests/fixtures/readiness.jsonl
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from supply_intelligence.mappers.seasonal_feature_mapper import seasonal_features_for_window
from supply_intelligence.mappers.supply_feature_mapper import species_row_to_features


def _iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    if not path.is_file():
        return
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def main() -> int:
    ap = argparse.ArgumentParser(description="Export merged supply feature rows (CSV to stdout).")
    ap.add_argument("--species", type=Path, help="JSONL of species_availability records (snake_case)")
    ap.add_argument("--seasonal", type=Path, help="JSONL of seasonal_window records")
    ap.add_argument("--month", type=int, default=6, help="Month 1-12 for seasonal features")
    ap.add_argument("--readiness", type=Path, help="JSONL of regional_supply_readiness rows")
    args = ap.parse_args()

    rows: list[dict[str, Any]] = []
    for p in filter(None, [args.species]):
        for rec in _iter_jsonl(p):
            f = species_row_to_features(rec)
            f["installer_region_readiness_score"] = 0.0
            rows.append(f)
    for p in filter(None, [args.seasonal]):
        for rec in _iter_jsonl(p):
            rows.append(seasonal_features_for_window(rec, args.month))
    for p in filter(None, [args.readiness]):
        for rec in _iter_jsonl(p):
            rows.append(
                {
                    "region_supply_readiness_score": float(rec.get("overall_supply_readiness_score") or 0),
                    "installer_region_readiness_score": float(rec.get("installer_coverage_score") or 0),
                    "region": rec.get("region"),
                    "project_type": rec.get("project_type"),
                    "solution_type": rec.get("solution_type"),
                },
            )

    w = csv.DictWriter(sys.stdout, fieldnames=sorted({k for r in rows for k in r.keys()}))
    w.writeheader()
    for r in rows:
        w.writerow({k: r.get(k, "") for k in w.fieldnames})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

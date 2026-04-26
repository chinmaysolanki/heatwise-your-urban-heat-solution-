#!/usr/bin/env python3
"""
From JSONL rows (each with pricing_input + targets), emit:
  pricing_features.csv, pricing_targets.csv, pricing_joined_training_table.csv

Example:
  PYTHONPATH=ml python -m pricing_intelligence.exporters.export_pricing_training_data \\
    --input pricing_intelligence/tests/fixtures/pricing_joined.jsonl --out-dir /tmp/pout
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Iterator

from pricing_intelligence.mappers.pricing_feature_mapper import map_pricing_feature_row


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
    args.out_dir.mkdir(parents=True, exist_ok=True)

    features_rows: list[dict[str, Any]] = []
    target_rows: list[dict[str, Any]] = []
    joined: list[dict[str, Any]] = []

    for rec in _iter_jsonl(args.input):
        feat = map_pricing_feature_row(rec)
        tgt = {
            "row_id": feat["feature_row_id"],
            "quoted_install_cost_inr": rec.get("quoted_install_cost_inr"),
            "final_install_cost_inr": rec.get("final_install_cost_inr"),
            "annual_maintenance_cost_inr": rec.get("annual_maintenance_cost_inr"),
            "estimate_error_pct": rec.get("estimate_error_pct"),
            "budget_fit_outcome": rec.get("budget_fit_outcome"),
        }
        features_rows.append(feat)
        target_rows.append(tgt)
        joined.append({**feat, **{k: v for k, v in tgt.items() if k != "row_id"}})

    def write_csv(name: str, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        path = args.out_dir / name
        keys = sorted({k for r in rows for k in r.keys()})
        with path.open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=keys)
            w.writeheader()
            for r in rows:
                w.writerow({k: r.get(k, "") for k in keys})

    write_csv("pricing_features.csv", features_rows)
    write_csv("pricing_targets.csv", target_rows)
    write_csv("pricing_joined_training_table.csv", joined)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

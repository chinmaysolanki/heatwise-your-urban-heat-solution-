#!/usr/bin/env python3
"""
From JSONL budget_fit_assessment rows, emit:
  budget_fit_records.csv, downgrade_scenarios.csv, affordability_outcomes.csv
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Iterator


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

    main_rows: list[dict[str, Any]] = []
    down: list[dict[str, Any]] = []
    aff: list[dict[str, Any]] = []

    for row in _iter_jsonl(args.input):
        main_rows.append(row)
        down.append(
            {
                "budget_fit_id": row.get("budget_fit_id"),
                "downgrade_suggestion_json": row.get("downgrade_suggestion_json"),
            },
        )
        aff.append(
            {
                "budget_fit_id": row.get("budget_fit_id"),
                "affordability_risk_level": row.get("affordability_risk_level"),
                "budget_fit_band": row.get("budget_fit_band"),
                "stretch_budget_required": row.get("stretch_budget_required"),
            },
        )

    def dump(name: str, rows: list[dict[str, Any]]) -> None:
        if not rows:
            return
        keys = sorted({k for r in rows for k in r.keys()})
        with (args.out_dir / name).open("w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=keys)
            w.writeheader()
            for r in rows:
                w.writerow({k: r.get(k, "") for k in keys})

    dump("budget_fit_records.csv", main_rows)
    dump("downgrade_scenarios.csv", down)
    dump("affordability_outcomes.csv", aff)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

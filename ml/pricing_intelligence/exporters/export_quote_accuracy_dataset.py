#!/usr/bin/env python3
"""
From JSONL quote_comparison records, emit:
  quote_accuracy_records.csv, final_cost_accuracy_records.csv, pricing_diagnostics.csv
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

    q_acc: list[dict[str, Any]] = []
    f_acc: list[dict[str, Any]] = []
    diag: list[dict[str, Any]] = []

    for row in _iter_jsonl(args.input):
        q_acc.append(
            {
                "quote_comparison_id": row.get("quote_comparison_id"),
                "predicted_install_cost_median_inr": row.get("predicted_install_cost_median_inr"),
                "quoted_install_cost_inr": row.get("quoted_install_cost_inr"),
                "install_cost_error_abs_inr": row.get("install_cost_error_abs_inr"),
                "install_cost_error_pct": row.get("install_cost_error_pct"),
            },
        )
        f_acc.append(
            {
                "quote_comparison_id": row.get("quote_comparison_id"),
                "quoted_install_cost_inr": row.get("quoted_install_cost_inr"),
                "final_install_cost_inr": row.get("final_install_cost_inr"),
                "quote_to_final_delta_inr": row.get("quote_to_final_delta_inr"),
                "quote_to_final_delta_pct": row.get("quote_to_final_delta_pct"),
            },
        )
        diag.append(
            {
                "quote_comparison_id": row.get("quote_comparison_id"),
                "pricing_accuracy_band": row.get("pricing_accuracy_band"),
                "cost_risk_flags_json": row.get("cost_risk_flags_json"),
                "notes": row.get("notes"),
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

    dump("quote_accuracy_records.csv", q_acc)
    dump("final_cost_accuracy_records.csv", f_acc)
    dump("pricing_diagnostics.csv", diag)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

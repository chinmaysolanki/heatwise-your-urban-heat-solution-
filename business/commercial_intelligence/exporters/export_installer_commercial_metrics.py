#!/usr/bin/env python3
"""
Input JSONL: installer_commercial_metrics rows + optional revenue_detail per installer.

Each line may be:
  { "installer_commercial_metrics": { ... }, "quote_conversion_detail": { ... } }

Outputs:
  installer_commercial_metrics.csv
  installer_revenue_breakdown.csv
  installer_quote_conversion_metrics.csv
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

    metrics: list[dict[str, Any]] = []
    revenue_rows: list[dict[str, Any]] = []
    conv_rows: list[dict[str, Any]] = []

    for rec in _iter_jsonl(args.input):
        m = rec.get("installer_commercial_metrics") or rec
        metrics.append(m)
        iid = m.get("installer_id")
        rid = m.get("installer_commercial_metrics_id")
        if rec.get("installer_revenue_breakdown"):
            for line in rec["installer_revenue_breakdown"]:
                revenue_rows.append({"installer_commercial_metrics_id": rid, "installer_id": iid, **line})
        else:
            revenue_rows.append(
                {
                    "installer_commercial_metrics_id": rid,
                    "installer_id": iid,
                    "component": "total_installer_revenue_inr",
                    "amount": m.get("total_installer_revenue_inr"),
                },
            )
        if rec.get("quote_conversion_detail"):
            conv_rows.append({**rec["quote_conversion_detail"], "installer_id": iid, "metrics_id": rid})
        else:
            conv_rows.append(
                {
                    "metrics_id": rid,
                    "installer_id": iid,
                    "quotes_submitted": m.get("quotes_submitted"),
                    "quotes_accepted": m.get("quotes_accepted"),
                    "quote_acceptance_rate": m.get("quote_acceptance_rate"),
                    "install_completion_rate": m.get("install_completion_rate"),
                    "avg_quote_to_final_delta_pct": m.get("avg_quote_to_final_delta_pct"),
                },
            )

    write_csv(args.out_dir / "installer_commercial_metrics.csv", metrics)
    write_csv(args.out_dir / "installer_revenue_breakdown.csv", revenue_rows)
    write_csv(args.out_dir / "installer_quote_conversion_metrics.csv", conv_rows)
    print(f"Wrote {len(metrics)} installer metric rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

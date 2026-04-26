#!/usr/bin/env python3
"""
Input JSONL: each line is a unit_economics_snapshot object (snake_case).

Outputs:
  unit_economics_snapshots.csv
  conversion_economics.csv
  revenue_margin_summary.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from commercial_intelligence.exporters._csv_util import write_csv
from commercial_intelligence.mappers.economics_mapper import (
    map_conversion_economics_row,
    map_revenue_margin_summary_row,
    map_unit_economics_snapshot_row,
)


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

    snaps = list(_iter_jsonl(args.input))
    write_csv(args.out_dir / "unit_economics_snapshots.csv", [map_unit_economics_snapshot_row(s) for s in snaps])
    write_csv(args.out_dir / "conversion_economics.csv", [map_conversion_economics_row(s) for s in snaps])
    write_csv(args.out_dir / "revenue_margin_summary.csv", [map_revenue_margin_summary_row(s) for s in snaps])
    print(f"Wrote {len(snaps)} unit economics rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

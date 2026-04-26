#!/usr/bin/env python3
"""
Input JSONL: one revenue_event object per line (snake_case keys matching schema).

Outputs:
  revenue_events.csv
  revenue_event_breakdowns.csv

Example:
  PYTHONPATH=business python -m commercial_intelligence.exporters.export_revenue_events \\
    --input commercial_intelligence/tests/fixtures/revenue_events.jsonl --out-dir /tmp/cexp
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from commercial_intelligence.exporters._csv_util import write_csv
from commercial_intelligence.mappers.revenue_event_mapper import (
    flatten_revenue_breakdowns,
    map_revenue_event_to_row,
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

    events = list(_iter_jsonl(args.input))
    flat = [map_revenue_event_to_row(e) for e in events]
    breaks = flatten_revenue_breakdowns(events)
    write_csv(args.out_dir / "revenue_events.csv", flat)
    write_csv(args.out_dir / "revenue_event_breakdowns.csv", breaks)
    print(f"Wrote {len(flat)} revenue rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

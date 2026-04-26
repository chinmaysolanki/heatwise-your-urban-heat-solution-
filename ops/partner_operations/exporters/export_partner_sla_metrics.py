#!/usr/bin/env python3
"""
JSONL of partner SLA metric documents -> partner_sla_metrics.csv

Example:
  cd heatwise/ops && PYTHONPATH=. python -m partner_operations.exporters.export_partner_sla_metrics \\
    --input partner_operations/tests/fixtures/partner_sla.jsonl --out-dir /tmp/psla
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from partner_operations.exporters._csv_util import write_csv
from partner_operations.mappers.sla_mapper import map_sla_metric_row


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

    rows = [map_sla_metric_row(e) for e in _iter_jsonl(args.input)]
    write_csv(args.out_dir / "partner_sla_metrics.csv", rows)
    print(f"Wrote {len(rows)} SLA rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

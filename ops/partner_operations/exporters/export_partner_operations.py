#!/usr/bin/env python3
"""
JSONL of partner ops records (`record_type`: partner_profile | partner_capability | field_ops_status) -> partner_operations.csv

Example:
  cd heatwise/ops && PYTHONPATH=. python -m partner_operations.exporters.export_partner_operations \\
    --input partner_operations/tests/fixtures/partner_ops.jsonl --out-dir /tmp/pops
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from partner_operations.exporters._csv_util import write_csv
from partner_operations.mappers.partner_mapper import (
    map_field_ops_row,
    map_partner_capability_row,
    map_partner_profile_row,
)


def _iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def _map_row(doc: dict[str, Any]) -> dict[str, Any]:
    rt = doc.get("record_type")
    if rt == "partner_profile":
        return map_partner_profile_row(doc)
    if rt == "partner_capability":
        return map_partner_capability_row(doc)
    if rt == "field_ops_status":
        return map_field_ops_row(doc)
    raise ValueError(f"unknown record_type: {rt!r}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True)
    ap.add_argument("--out-dir", type=Path, required=True)
    args = ap.parse_args()

    rows = []
    for doc in _iter_jsonl(args.input):
        rows.append(_map_row(doc))
    write_csv(args.out_dir / "partner_operations.csv", rows)
    print(f"Wrote {len(rows)} partner ops rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

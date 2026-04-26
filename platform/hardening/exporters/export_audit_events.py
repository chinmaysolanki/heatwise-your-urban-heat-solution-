#!/usr/bin/env python3
"""
JSONL of audit_event documents -> audit_events.csv

Example:
  cd heatwise/platform && PYTHONPATH=. python -m hardening.exporters.export_audit_events \\
    --input hardening/tests/fixtures/audit_events.jsonl --out-dir /tmp/hw_audit
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from hardening.exporters._csv_util import write_csv
from hardening.mappers.error_mapper import map_audit_event_to_row


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

    rows = [map_audit_event_to_row(e) for e in _iter_jsonl(args.input)]
    write_csv(args.out_dir / "audit_events.csv", rows)
    print(f"Wrote {len(rows)} audit rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

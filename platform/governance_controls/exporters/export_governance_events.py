#!/usr/bin/env python3
"""
JSONL governance events (record_type: consent_record | policy_flag | governance_review) -> governance_events.csv

Example:
  cd heatwise/platform && PYTHONPATH=. python -m governance_controls.exporters.export_governance_events \\
    --input governance_controls/tests/fixtures/governance_events.jsonl --out-dir /tmp/gov
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from governance_controls.exporters._csv_util import write_csv
from governance_controls.mappers.governance_mapper import map_governance_event_row


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

    rows = [map_governance_event_row(e) for e in _iter_jsonl(args.input)]
    write_csv(args.out_dir / "governance_events.csv", rows)
    print(f"Wrote {len(rows)} governance rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

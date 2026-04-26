#!/usr/bin/env python3
"""
Export integration audit events from JSONL to CSV for analytics / debugging.

Each input line is a full integration_event document (snake_case, schema-aligned).

Example:
  cd heatwise/platform && PYTHONPATH=. python -m integrations.exporters.export_integration_events \\
    --input integrations/tests/fixtures/integration_events.jsonl --out-dir /tmp/hw_int
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from integrations.exporters._csv_util import write_csv
from integrations.mappers.integration_mapper import map_integration_event_to_row


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
    flat = [map_integration_event_to_row(e) for e in events]
    write_csv(args.out_dir / "integration_events.csv", flat)
    print(f"Wrote {len(flat)} integration event rows", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

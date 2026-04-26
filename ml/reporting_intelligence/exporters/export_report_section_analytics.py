#!/usr/bin/env python3
"""
JSONL: lines with "sections" and "explanations" arrays (same as export_report_payloads).

Outputs:
  report_section_presence.csv
  report_confidence_summary.csv
  explanation_source_mix.csv
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any, Iterator

from reporting_intelligence.exporters._csv_util import write_csv
from reporting_intelligence.mappers.report_payload_mapper import map_section_to_analytics_row


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

    presence: list[dict[str, Any]] = []
    conf_counter: Counter[str] = Counter()
    layer_counter: Counter[str] = Counter()

    for rec in _iter_jsonl(args.input):
        for s in rec.get("sections") or []:
            presence.append(map_section_to_analytics_row(s))
        for e in rec.get("explanations") or []:
            cb = e.get("confidence_band") or "unset"
            conf_counter[cb] += 1
            layer_counter[e.get("source_layer") or "unknown"] += 1

    conf_rows = [{"confidence_band": k, "count": v} for k, v in sorted(conf_counter.items())]
    mix_rows = [{"source_layer": k, "count": v} for k, v in sorted(layer_counter.items())]

    write_csv(args.out_dir / "report_section_presence.csv", presence)
    write_csv(args.out_dir / "report_confidence_summary.csv", conf_rows)
    write_csv(args.out_dir / "explanation_source_mix.csv", mix_rows)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

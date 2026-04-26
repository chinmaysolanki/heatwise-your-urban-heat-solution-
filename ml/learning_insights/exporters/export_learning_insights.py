#!/usr/bin/env python3
"""
JSONL lines: { "insight": {...}, "variants": [ ... ], "lessons": [ ... ] }

Outputs:
  recommendation_insights.csv
  variant_performance.csv
  lesson_memory_index.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from learning_insights.exporters._csv_util import write_csv
from learning_insights.mappers.insight_mapper import map_insight_to_row, map_variant_to_row
from learning_insights.mappers.lesson_memory_mapper import map_lesson_to_row


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

    insights: list[dict[str, Any]] = []
    variants: list[dict[str, Any]] = []
    lessons: list[dict[str, Any]] = []

    for rec in _iter_jsonl(args.input):
        if rec.get("insight"):
            insights.append(map_insight_to_row(rec["insight"]))
        for v in rec.get("variants") or []:
            variants.append(map_variant_to_row(v))
        for L in rec.get("lessons") or []:
            lessons.append(map_lesson_to_row(L))

    write_csv(args.out_dir / "recommendation_insights.csv", insights)
    write_csv(args.out_dir / "variant_performance.csv", variants)
    write_csv(args.out_dir / "lesson_memory_index.csv", lessons)
    print(f"insights={len(insights)} variants={len(variants)} lessons={len(lessons)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

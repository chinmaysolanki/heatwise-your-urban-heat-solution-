#!/usr/bin/env python3
"""Aggregate exposure JSONL by variant and print markdown summary."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("jsonl", type=Path, help="Path to exposures_*.jsonl")
    p.add_argument("-o", "--output", type=Path, default=None)
    args = p.parse_args()

    by_variant: dict[str, list[dict]] = defaultdict(list)
    with args.jsonl.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            v = str(row.get("assigned_variant") or "unknown")
            by_variant[v].append(row)

    lines = ["# Variant comparison", "", f"- source: `{args.jsonl}`", ""]
    for v, rows in sorted(by_variant.items()):
        n = len(rows)
        lat = sorted(float(r.get("latency_ms") or 0) for r in rows)
        med = lat[len(lat) // 2] if lat else 0
        lines.append(f"## {v}")
        lines.append(f"- count: {n}")
        lines.append(f"- median_latency_ms: {med:.1f}")
        lines.append("")

    text = "\n".join(lines)
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()

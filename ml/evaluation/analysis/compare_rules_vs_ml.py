#!/usr/bin/env python3
"""Compare rules_only vs hybrid rows in evaluation JSONL (top-1 match rates)."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("eval_jsonl", type=Path)
    p.add_argument("-o", "--output", type=Path, default=None)
    args = p.parse_args()

    total = 0
    matches = 0
    with args.eval_jsonl.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            total += 1
            if row.get("exact_top1_match"):
                matches += 1

    rate = matches / total if total else 0.0
    text = "\n".join(
        [
            "# Rules vs ML alignment (evaluation log)",
            "",
            f"- rows: {total}",
            f"- exact_top1_match_rate: {rate:.4f}",
            "",
        ],
    )
    if args.output:
        args.output.write_text(text, encoding="utf-8")
    else:
        print(text)


if __name__ == "__main__":
    main()

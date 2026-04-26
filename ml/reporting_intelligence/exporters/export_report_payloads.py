#!/usr/bin/env python3
"""
JSONL: each line { "dossier": {...}, "sections": [...], "explanations": [...] }

Outputs: recommendation_dossiers.csv, report_sections.csv, report_explanations.csv
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from reporting_intelligence.exporters._csv_util import write_csv


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

    dossiers: list[dict[str, Any]] = []
    sections: list[dict[str, Any]] = []
    explanations: list[dict[str, Any]] = []

    for rec in _iter_jsonl(args.input):
        d = rec.get("dossier")
        if d:
            dossiers.append(d)
        for s in rec.get("sections") or []:
            sections.append(s)
        for e in rec.get("explanations") or []:
            explanations.append(e)

    write_csv(args.out_dir / "recommendation_dossiers.csv", dossiers)
    write_csv(args.out_dir / "report_sections.csv", sections)
    write_csv(args.out_dir / "report_explanations.csv", explanations)
    print(f"dossiers={len(dossiers)} sections={len(sections)} explanations={len(explanations)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

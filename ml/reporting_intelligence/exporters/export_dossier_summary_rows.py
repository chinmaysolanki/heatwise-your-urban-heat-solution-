#!/usr/bin/env python3
"""
JSONL: each line may include dossier, installer_summary, admin_review objects.

Outputs:
  dossier_summary_rows.csv
  installer_summary_rows.csv
  admin_review_summary_rows.csv
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterator

from reporting_intelligence.exporters._csv_util import write_csv
from reporting_intelligence.mappers.dossier_mapper import map_dossier_to_summary_row


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

    drows: list[dict[str, Any]] = []
    irows: list[dict[str, Any]] = []
    arows: list[dict[str, Any]] = []

    for rec in _iter_jsonl(args.input):
        if rec.get("dossier"):
            drows.append(map_dossier_to_summary_row(rec["dossier"]))
        if rec.get("installer_summary"):
            irows.append(rec["installer_summary"])
        if rec.get("admin_review"):
            arows.append(rec["admin_review"])

    write_csv(args.out_dir / "dossier_summary_rows.csv", drows)
    write_csv(args.out_dir / "installer_summary_rows.csv", irows)
    write_csv(args.out_dir / "admin_review_summary_rows.csv", arows)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

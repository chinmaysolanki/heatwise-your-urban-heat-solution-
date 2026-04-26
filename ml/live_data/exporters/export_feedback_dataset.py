#!/usr/bin/env python3
"""
Read telemetry JSONL dumps (one object per line) and write canonical CSV tables.

Expected input files (default names in ``input_dir``):
  - recommendation_sessions.jsonl
  - candidate_snapshots.jsonl
  - feedback_events.jsonl
  - install_outcomes.jsonl

Typical source: Prisma export script or ETL from Postgres.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd

_LIVE_ROOT = Path(__file__).resolve().parent.parent
if str(_LIVE_ROOT) not in sys.path:
    sys.path.insert(0, str(_LIVE_ROOT))


def _read_jsonl(path: Path) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def export_feedback_tables(input_dir: Path, output_dir: Path) -> dict[str, Path]:
    input_dir = Path(input_dir)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    sessions = _read_jsonl(input_dir / "recommendation_sessions.jsonl")
    snaps = _read_jsonl(input_dir / "candidate_snapshots.jsonl")
    events = _read_jsonl(input_dir / "feedback_events.jsonl")
    outcomes = _read_jsonl(input_dir / "install_outcomes.jsonl")

    paths: dict[str, Path] = {}
    if sessions:
        p = output_dir / "recommendation_sessions.csv"
        pd.DataFrame(sessions).to_csv(p, index=False)
        paths["recommendation_sessions"] = p
    if snaps:
        p = output_dir / "candidate_snapshots.csv"
        pd.DataFrame(snaps).to_csv(p, index=False)
        paths["candidate_snapshots"] = p
    if events:
        p = output_dir / "feedback_events.csv"
        pd.DataFrame(events).to_csv(p, index=False)
        paths["feedback_events"] = p
    if outcomes:
        p = output_dir / "install_outcomes.csv"
        pd.DataFrame(outcomes).to_csv(p, index=False)
        paths["install_outcomes"] = p

    # Simple implicit aggregates: max dwell per candidate-session
    agg_rows: list[dict[str, Any]] = []
    if events:
        df = pd.DataFrame(events)
        for old, new in (
            ("recommendationSessionId", "recommendation_session_id"),
            ("candidateSnapshotId", "candidate_snapshot_id"),
            ("dwellTimeMs", "dwell_time_ms"),
        ):
            if new not in df.columns and old in df.columns:
                df = df.rename(columns={old: new})
        if "dwell_time_ms" in df.columns and "candidate_snapshot_id" in df.columns:
            g = (
                df.groupby(["recommendation_session_id", "candidate_snapshot_id"], dropna=True)[
                    "dwell_time_ms"
                ]
                .max()
                .reset_index()
            )
            agg_rows = g.to_dict("records")
    if agg_rows:
        p = output_dir / "implicit_signal_aggregates.csv"
        pd.DataFrame(agg_rows).to_csv(p, index=False)
        paths["implicit_signal_aggregates"] = p

    return paths


def main() -> int:
    ap = argparse.ArgumentParser(description="Export feedback JSONL → CSV tables.")
    ap.add_argument("--input-dir", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()
    paths = export_feedback_tables(args.input_dir, args.output_dir)
    print(json.dumps({k: str(v) for k, v in paths.items()}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

import csv
import io
import subprocess
import sys
from pathlib import Path

import os

ROOT = Path(__file__).resolve().parents[1]
ML = ROOT.parent
FIX = Path(__file__).resolve().parent / "fixtures"


def test_export_supply_features_csv_header() -> None:
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "supply_intelligence.exporters.export_supply_features",
            "--species",
            str(FIX / "species.jsonl"),
            "--readiness",
            str(FIX / "readiness.jsonl"),
        ],
        capture_output=True,
        text=True,
        check=False,
        cwd=str(ML),
        env={**os.environ, "PYTHONPATH": str(ML)},
    )
    assert proc.returncode == 0, proc.stderr
    r = csv.DictReader(io.StringIO(proc.stdout))
    rows = list(r)
    assert rows
    assert "species_local_availability_score" in rows[0]


def test_export_constraint_impact() -> None:
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "supply_intelligence.exporters.export_constraint_impact_dataset",
            "--snapshots",
            str(FIX / "snapshots.jsonl"),
        ],
        capture_output=True,
        text=True,
        check=False,
        cwd=str(ML),
        env={**os.environ, "PYTHONPATH": str(ML)},
    )
    assert proc.returncode == 0, proc.stderr
    r = csv.DictReader(io.StringIO(proc.stdout))
    rows = list(r)
    assert rows[0].get("constraint_penalty_score")

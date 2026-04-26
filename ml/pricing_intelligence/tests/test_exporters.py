from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ML = Path(__file__).resolve().parents[2]
FIX = Path(__file__).resolve().parent / "fixtures"


def test_export_pricing_training_creates_csv(tmp_path: Path) -> None:
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "pricing_intelligence.exporters.export_pricing_training_data",
            "--input",
            str(FIX / "pricing_joined.jsonl"),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=str(ML),
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONPATH": str(ML)},
    )
    assert proc.returncode == 0, proc.stderr
    assert (tmp_path / "pricing_features.csv").is_file()
    assert (tmp_path / "pricing_joined_training_table.csv").is_file()


def test_export_quote_accuracy(tmp_path: Path) -> None:
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "pricing_intelligence.exporters.export_quote_accuracy_dataset",
            "--input",
            str(FIX / "quote_comparison.jsonl"),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=str(ML),
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONPATH": str(ML)},
    )
    assert proc.returncode == 0, proc.stderr
    assert (tmp_path / "quote_accuracy_records.csv").is_file()


def test_export_budget_fit(tmp_path: Path) -> None:
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "pricing_intelligence.exporters.export_budget_fit_dataset",
            "--input",
            str(FIX / "budget_fit.jsonl"),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=str(ML),
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONPATH": str(ML)},
    )
    assert proc.returncode == 0, proc.stderr
    assert (tmp_path / "budget_fit_records.csv").is_file()

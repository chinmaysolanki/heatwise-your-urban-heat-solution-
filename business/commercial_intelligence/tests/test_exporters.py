from __future__ import annotations

import csv
from pathlib import Path

import pytest

_ROOT = Path(__file__).resolve().parent
_FIX = _ROOT / "fixtures"


@pytest.fixture
def out_dir(tmp_path: Path) -> Path:
    return tmp_path / "out"


def test_export_revenue_events(out_dir: Path) -> None:
    from commercial_intelligence.exporters import export_revenue_events

    inp = _FIX / "revenue_events.jsonl"
    assert inp.exists()
    import sys

    old = sys.argv
    try:
        sys.argv = ["export_revenue_events", "--input", str(inp), "--out-dir", str(out_dir)]
        code = export_revenue_events.main()
    finally:
        sys.argv = old
    assert code == 0
    rev = out_dir / "revenue_events.csv"
    assert rev.exists()
    rows = list(csv.DictReader(rev.open(encoding="utf-8")))
    assert len(rows) == 2


def test_export_unit_economics(out_dir: Path) -> None:
    from commercial_intelligence.exporters import export_unit_economics

    inp = _FIX / "unit_economics.jsonl"
    import sys

    old = sys.argv
    try:
        sys.argv = ["export_unit_economics", "--input", str(inp), "--out-dir", str(out_dir)]
        assert export_unit_economics.main() == 0
    finally:
        sys.argv = old
    assert (out_dir / "conversion_economics.csv").exists()


def test_export_installer_and_cohort(out_dir: Path) -> None:
    from commercial_intelligence.exporters import export_cohort_metrics, export_installer_commercial_metrics

    import sys

    old = sys.argv
    try:
        sys.argv = [
            "x",
            "--input",
            str(_FIX / "installer_metrics.jsonl"),
            "--out-dir",
            str(out_dir / "i"),
        ]
        assert export_installer_commercial_metrics.main() == 0
        sys.argv = ["x", "--input", str(_FIX / "cohort_rows.jsonl"), "--out-dir", str(out_dir / "c")]
        assert export_cohort_metrics.main() == 0
    finally:
        sys.argv = old

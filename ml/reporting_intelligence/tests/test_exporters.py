from __future__ import annotations

import csv
from pathlib import Path

import pytest

_FIX = Path(__file__).resolve().parent / "fixtures"


def test_export_report_payloads(tmp_path: Path) -> None:
    from reporting_intelligence.exporters import export_report_payloads

    import sys

    out = tmp_path / "o"
    old = sys.argv
    try:
        sys.argv = ["x", "--input", str(_FIX / "report_bundle.jsonl"), "--out-dir", str(out)]
        assert export_report_payloads.main() == 0
    finally:
        sys.argv = old
    assert (out / "recommendation_dossiers.csv").exists()
    rows = list(csv.DictReader((out / "report_sections.csv").open(encoding="utf-8")))
    assert len(rows) == 7


def test_export_section_analytics(tmp_path: Path) -> None:
    from reporting_intelligence.exporters import export_report_section_analytics

    import sys

    old = sys.argv
    try:
        sys.argv = ["x", "--input", str(_FIX / "report_bundle.jsonl"), "--out-dir", str(tmp_path)]
        assert export_report_section_analytics.main() == 0
    finally:
        sys.argv = old
    assert (tmp_path / "explanation_source_mix.csv").exists()


def test_export_dossier_summaries(tmp_path: Path) -> None:
    from reporting_intelligence.exporters import export_dossier_summary_rows

    import sys

    old = sys.argv
    try:
        sys.argv = ["x", "--input", str(_FIX / "report_bundle.jsonl"), "--out-dir", str(tmp_path / "s")]
        assert export_dossier_summary_rows.main() == 0
    finally:
        sys.argv = old
    assert (tmp_path / "s" / "dossier_summary_rows.csv").exists()
    assert (tmp_path / "s" / "installer_summary_rows.csv").exists()
    assert (tmp_path / "s" / "admin_review_summary_rows.csv").exists()

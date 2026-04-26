from __future__ import annotations

from pathlib import Path

from learning_insights.validators.validate_recommendation_insight import (
    validate_lesson_memory_record,
    validate_recommendation_insight,
    validate_segment_key_format,
)
from learning_insights.validators.validate_variant_performance import validate_variant_performance

_FIX = Path(__file__).resolve().parent / "fixtures"


def test_insight_valid() -> None:
    p = {
        "recommendation_insight_id": "i1",
        "window_start": "2026-01-01T00:00:00Z",
        "window_end": "2026-02-01T00:00:00Z",
        "insight_type": "window_summary",
        "scope_json": "{}",
        "metrics_json": "{}",
        "evidence_refs_json": "[]",
        "source_layers_json": "[]",
        "created_at": "2026-02-02T00:00:00Z",
    }
    assert validate_recommendation_insight(p).ok


def test_insight_bad_window() -> None:
    p = {
        "recommendation_insight_id": "i1",
        "window_start": "2026-02-01T00:00:00Z",
        "window_end": "2026-01-01T00:00:00Z",
        "insight_type": "window_summary",
        "scope_json": "{}",
        "metrics_json": "{}",
        "evidence_refs_json": "[]",
        "source_layers_json": "[]",
        "created_at": "2026-02-02T00:00:00Z",
    }
    assert not validate_recommendation_insight(p).ok


def test_lesson_evidence_required() -> None:
    p = {
        "lesson_memory_id": "l1",
        "lesson_key": "k",
        "polarity": "works",
        "confidence_band": "high",
        "summary_structured_json": "{}",
        "evidence_refs_json": "[]",
        "created_by": "system",
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
    }
    assert not validate_lesson_memory_record(p).ok


def test_segment_key_format() -> None:
    assert validate_segment_key_format(
        "pt:rooftop|cz:x|bb:y|r:z|ut:a|ia:b|pc:c",
    ).ok
    assert not validate_segment_key_format("short").ok


def test_variant_score_range() -> None:
    p = {
        "variant_performance_id": "v1",
        "window_start": "2026-01-01T00:00:00Z",
        "window_end": "2026-02-01T00:00:00Z",
        "session_count": 1,
        "candidate_count": 3,
        "verified_install_count": 0,
        "dossier_created_count": 0,
        "followup_completed_count": 0,
        "commercial_installed_count": 0,
        "avg_blended_score": 5.0,
        "created_at": "2026-02-02T00:00:00Z",
    }
    assert not validate_variant_performance(p).ok


def test_export_learning_insights_cli(tmp_path) -> None:
    from learning_insights.exporters import export_learning_insights

    import sys

    inp = _FIX / "learning_bundle.jsonl"
    old = sys.argv
    try:
        sys.argv = ["x", "--input", str(inp), "--out-dir", str(tmp_path)]
        assert export_learning_insights.main() == 0
    finally:
        sys.argv = old
    assert (tmp_path / "recommendation_insights.csv").exists()


def test_export_segment_cli(tmp_path) -> None:
    from learning_insights.exporters import export_segment_performance

    import sys

    inp = _FIX / "learning_bundle.jsonl"
    old = sys.argv
    try:
        sys.argv = ["x", "--input", str(inp), "--out-dir", str(tmp_path / "s")]
        assert export_segment_performance.main() == 0
    finally:
        sys.argv = old
    assert (tmp_path / "s" / "segment_performance_export.csv").exists()

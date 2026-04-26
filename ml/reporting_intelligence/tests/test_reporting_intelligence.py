from __future__ import annotations

import json
from pathlib import Path

from reporting_intelligence.mappers.explanation_section_mapper import map_explanation_to_row
from reporting_intelligence.mappers.report_payload_mapper import (
    USER_REPORT_VISIBILITY,
    filter_sections_by_visibility,
    map_ts_dossier_row_to_canonical,
)
from reporting_intelligence.section_blueprint import DOSSIER_REQUIRED_SECTION_KEYS
from reporting_intelligence.validators.validate_admin_review_dossier import validate_admin_review_dossier
from reporting_intelligence.validators.validate_recommendation_dossier import (
    validate_dossier_export_bundle,
    validate_recommendation_dossier,
    validate_section_ordering,
)
from reporting_intelligence.validators.validate_report_explanation import validate_report_explanation
from reporting_intelligence.validators.validate_report_section import validate_report_section

_FIX = Path(__file__).resolve().parent / "fixtures"


def _min_dossier(dtype: str) -> dict:
    return {
        "recommendation_dossier_id": "d1",
        "project_id": "p",
        "recommendation_session_id": "s",
        "candidate_snapshot_ids_json": '["a","b"]',
        "selected_candidate_snapshot_id": "a",
        "generated_at": "2026-03-28T00:00:00Z",
        "dossier_type": dtype,
        "dossier_version": "1.0.0",
        "project_context_snapshot_json": "{}",
        "recommendation_summary_json": "{}",
        "explanation_provenance_json": "{}",
    }


def test_dossier_valid_full_user_blueprint() -> None:
    p = _min_dossier("user_final_recommendation")
    keys = sorted(DOSSIER_REQUIRED_SECTION_KEYS["user_final_recommendation"])
    assert validate_recommendation_dossier(p, section_keys=keys).ok


def test_dossier_rejects_selected_not_in_list() -> None:
    p = {
        "recommendation_dossier_id": "d1",
        "project_id": "p",
        "recommendation_session_id": "s",
        "candidate_snapshot_ids_json": '["a"]',
        "selected_candidate_snapshot_id": "z",
        "generated_at": "2026-03-28T00:00:00Z",
        "dossier_type": "user_final_recommendation",
        "dossier_version": "1.0.0",
        "project_context_snapshot_json": "{}",
        "recommendation_summary_json": "{}",
        "explanation_provenance_json": "{}",
    }
    assert not validate_recommendation_dossier(p).ok


def test_section_ordering_duplicate() -> None:
    secs = [
        {"section_order": 0},
        {"section_order": 0},
    ]
    assert not validate_section_ordering(secs).ok


def test_section_ordering_gap_rejected() -> None:
    secs = [{"section_order": 0}, {"section_order": 2}]
    assert not validate_section_ordering(secs).ok


def test_report_section_payload_object() -> None:
    p = {
        "report_section_id": "r1",
        "recommendation_dossier_id": "d1",
        "section_key": "project_summary",
        "section_order": 0,
        "section_title": "t",
        "section_type": "structured",
        "section_payload_json": "{\"k\":1}",
        "visibility_scope": "user",
        "created_at": "2026-03-28T00:00:00Z",
    }
    assert validate_report_section(p).ok


def test_explanation_invalid_confidence() -> None:
    p = {
        "report_explanation_id": "e1",
        "recommendation_dossier_id": "d1",
        "related_section_key": "project_summary",
        "explanation_type": "t",
        "source_layer": "rules",
        "explanation_payload_json": "{}",
        "confidence_band": "nope",
        "created_at": "2026-03-28T00:00:00Z",
    }
    assert not validate_report_explanation(p).ok


def test_explanation_rejects_unknown_section_key() -> None:
    p = {
        "report_explanation_id": "e1",
        "recommendation_dossier_id": "d1",
        "related_section_key": "not_a_real_key",
        "explanation_type": "t",
        "source_layer": "rules",
        "explanation_payload_json": "{}",
        "created_at": "2026-03-28T00:00:00Z",
    }
    assert not validate_report_explanation(p).ok


def test_installer_summary() -> None:
    p = {
        "installer_execution_summary_id": "i1",
        "recommendation_dossier_id": "d1",
        "project_id": "p",
        "execution_payload_json": "{}",
        "created_at": "2026-03-28T00:00:00Z",
    }
    from reporting_intelligence.validators.validate_installer_summary import validate_installer_summary

    assert validate_installer_summary(p).ok


def test_missing_required_sections_admin() -> None:
    p = _min_dossier("admin_internal_review")
    r = validate_recommendation_dossier(p, section_keys=["project_summary"])
    assert not r.ok


def test_unexpected_section_key_for_dossier_type() -> None:
    p = _min_dossier("scenario_comparison_pack")
    keys = list(DOSSIER_REQUIRED_SECTION_KEYS["scenario_comparison_pack"]) + ["admin_risk_review"]
    r = validate_recommendation_dossier(p, section_keys=keys)
    assert not r.ok
    assert any("unexpected section keys" in e for e in r.errors)


def test_visibility_filter_matches_user_report_service() -> None:
    sections = [
        {"section_key": "a", "visibility_scope": "user"},
        {"section_key": "b", "visibility_scope": "admin"},
        {"section_key": "c", "visibility_scope": "shared"},
    ]
    out = filter_sections_by_visibility(sections, USER_REPORT_VISIBILITY)
    assert [s["section_key"] for s in out] == ["a", "c"]


def test_explanation_mapper_keys() -> None:
    row = map_explanation_to_row(
        {
            "report_explanation_id": "x",
            "recommendation_dossier_id": "d",
            "related_section_key": "cost_summary",
            "explanation_type": "provenance_trace",
            "source_layer": "pricing",
            "source_reference_id": "p1",
            "explanation_payload_json": json.dumps({"a": 1, "b": 2}),
            "confidence_band": "medium",
        },
    )
    assert row["payload_keys"] == "a,b"


def test_admin_review_validator() -> None:
    assert validate_admin_review_dossier(
        {
            "admin_review_dossier_id": "a1",
            "recommendation_dossier_id": "d1",
            "review_payload_json": "{}",
            "risk_assessment_json": "{}",
            "created_at": "2026-03-28T00:00:00Z",
        },
    ).ok


def test_map_ts_dossier_row_to_canonical() -> None:
    canon = map_ts_dossier_row_to_canonical(
        {
            "id": "cid",
            "projectId": "pid",
            "recommendationSessionId": "sid",
            "candidateSnapshotIdsJson": "[]",
            "generatedAt": "2026-03-28T00:00:00.000Z",
            "dossierType": "user_final_recommendation",
            "dossierVersion": "1",
            "projectContextSnapshotJson": "{}",
            "recommendationSummaryJson": "{}",
            "explanationProvenanceJson": "{}",
        },
    )
    assert canon["recommendation_dossier_id"] == "cid"
    assert canon["project_id"] == "pid"


def test_validate_bundle_fixture() -> None:
    line = (_FIX / "report_bundle.jsonl").read_text(encoding="utf-8").strip().splitlines()[-1]
    rec = json.loads(line)
    v = validate_dossier_export_bundle(rec["dossier"], rec["sections"], rec["explanations"])
    assert v.ok, v.errors


def test_explanation_orphan_section_reference_fails_bundle() -> None:
    d = _min_dossier("scenario_comparison_pack")
    order = [
        "project_summary",
        "recommendation_overview",
        "candidate_breakdown",
        "cost_summary",
        "phased_plan_summary",
        "supply_constraints_summary",
        "evidence_and_confidence",
    ]
    sections = [
        {
            "report_section_id": f"r{i}",
            "recommendation_dossier_id": "d1",
            "section_key": k,
            "section_order": i,
            "section_title": k,
            "section_type": "structured",
            "section_payload_json": "{}",
            "visibility_scope": "shared" if k in ("recommendation_overview", "supply_constraints_summary", "evidence_and_confidence") else "user",
            "created_at": "2026-03-28T12:00:00Z",
        }
        for i, k in enumerate(order)
    ]
    expl = [
        {
            "report_explanation_id": "e1",
            "recommendation_dossier_id": "d1",
            "related_section_key": "space_analysis",
            "explanation_type": "t",
            "source_layer": "rules",
            "explanation_payload_json": "{}",
            "created_at": "2026-03-28T00:00:00Z",
        },
    ]
    v = validate_dossier_export_bundle(d, sections, expl)
    assert not v.ok
    assert any("unknown section_key" in e for e in v.errors)

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

from governance_controls.mappers.governance_mapper import map_consent_record_row
from governance_controls.mappers.retention_mapper import map_retention_policy_row
from governance_controls.validators.validate_consent_record import validate_consent_record
from governance_controls.validators.validate_data_retention import validate_data_retention
from governance_controls.validators.validate_policy_flag import validate_policy_flag

_ROOT = Path(__file__).resolve().parent.parent
_PLATFORM = _ROOT.parent
_FIX_GOV = _ROOT / "tests" / "fixtures" / "governance_events.jsonl"
_FIX_RET = _ROOT / "tests" / "fixtures" / "retention_policies.jsonl"
_REVIEW_SCHEMA = _ROOT / "schemas" / "governance_review_schema.json"


def test_consent_lifecycle_validation() -> None:
    grant = {
        "user_id": "cabcdefghijklmnopqrs012345",
        "consent_scope": "analytics_usage",
        "consent_status": "granted",
    }
    assert validate_consent_record(grant).ok
    row = map_consent_record_row({**grant, "record_type": "consent_record"})
    assert row["consent_status"] == "granted"

    bad_scope = dict(grant)
    bad_scope["consent_scope"] = "surveillance_always"
    assert not validate_consent_record(bad_scope).ok


def test_policy_flag_creation_update_shape() -> None:
    doc = {
        "flag_type": "missing_evidence",
        "severity": "medium",
        "status": "open",
        "title": "No photo evidence for verified install",
    }
    assert validate_policy_flag(doc).ok

    bad = dict(doc)
    bad["severity"] = "mega"
    assert not validate_policy_flag(bad).ok

    bad_status = dict(doc)
    bad_status["status"] = "lgtm"
    assert not validate_policy_flag(bad_status).ok


def test_retention_summary_generation_validates() -> None:
    doc = {
        "entity_category": "integration_events",
        "default_retention_days": 400,
        "archive_after_days": 90,
        "hard_delete_after_days": 400,
    }
    assert validate_data_retention(doc).ok

    bad = dict(doc)
    bad["archive_after_days"] = 300
    bad["hard_delete_after_days"] = 100
    assert not validate_data_retention(bad).ok

    bad2 = {"entity_category": "user_profile", "default_retention_days": 0}
    assert not validate_data_retention(bad2).ok


def test_governance_review_flow_schema() -> None:
    v = Draft202012Validator(json.loads(_REVIEW_SCHEMA.read_text(encoding="utf-8")))
    ok = {
        "review_type": "data_subject_request",
        "subject_entity_type": "User",
        "subject_entity_id": "cabcdefghijklmnopqrs012345",
        "related_user_id": "cabcdefghijklmnopqrs012345",
    }
    assert not list(v.iter_errors(ok))

    broken = dict(ok)
    broken["subject_entity_id"] = "not-cuid"
    assert list(v.iter_errors(broken))


def test_exporter_correctness(tmp_path: Path) -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "governance_controls.exporters.export_governance_events",
            "--input",
            str(_FIX_GOV),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=_PLATFORM,
        env={**dict(**__import__("os").environ), "PYTHONPATH": str(_PLATFORM)},
        check=True,
    )
    g = (tmp_path / "governance_events.csv").read_text(encoding="utf-8")
    assert "consent_record" in g
    assert "policy_flag" in g

    subprocess.run(
        [
            sys.executable,
            "-m",
            "governance_controls.exporters.export_retention_reviews",
            "--input",
            str(_FIX_RET),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=_PLATFORM,
        env={**dict(**__import__("os").environ), "PYTHONPATH": str(_PLATFORM)},
        check=True,
    )
    r = (tmp_path / "retention_policy_reviews.csv").read_text(encoding="utf-8")
    assert "recommendation_telemetry" in r

    first_ret = json.loads(_FIX_RET.read_text(encoding="utf-8").splitlines()[0])
    row = map_retention_policy_row(first_ret)
    assert row["default_retention_days"] == 1095

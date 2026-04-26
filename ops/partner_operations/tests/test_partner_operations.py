from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from jsonschema import Draft202012Validator

from partner_operations.mappers.partner_mapper import map_partner_profile_row
from partner_operations.mappers.sla_mapper import map_sla_metric_row
from partner_operations.validators.validate_field_ops_status import validate_field_ops_status
from partner_operations.validators.validate_partner_capability import validate_partner_capability
from partner_operations.validators.validate_partner_profile import validate_partner_profile

_ROOT = Path(__file__).resolve().parent.parent
_OPS = _ROOT.parent
_FIX_OPS = _ROOT / "tests" / "fixtures" / "partner_ops.jsonl"
_FIX_SLA = _ROOT / "tests" / "fixtures" / "partner_sla.jsonl"
_SLA_SCHEMA = _ROOT / "schemas" / "partner_sla_schema.json"


def test_partner_profile_creation_valid() -> None:
    doc = {
        "installer_id": "cabcdefghijklmnopqrs012345",
        "organization_name": "Acme Installers",
        "service_areas": [{"region_code": "IN-DL", "priority": 2}],
        "compliance_status": "pending",
        "partner_active_status": "onboarding",
    }
    r = validate_partner_profile(doc)
    assert r.ok
    row = map_partner_profile_row({**doc, "record_type": "partner_profile"})
    assert "IN-DL" in row["service_areas_json"]


def test_partner_profile_bad_service_area() -> None:
    doc = {
        "installer_id": "cabcdefghijklmnopqrs012345",
        "service_areas": [{"region_code": ""}],
    }
    assert not validate_partner_profile(doc).ok


def test_capability_matching_matrix_invalid() -> None:
    ok = {
        "installer_id": "cabcdefghijklmnopqrs012345",
        "project_types": ["terrace"],
        "solution_types": ["edible"],
        "complexity_bands": ["low"],
        "service_readiness": "ready",
    }
    assert validate_partner_capability(ok).ok

    bad = dict(ok)
    bad["project_types"] = ["unknown_roof"]
    assert not validate_partner_capability(bad).ok


def test_field_status_updates_invalid_readiness() -> None:
    doc = {
        "installer_id": "cabcdefghijklmnopqrs012345",
        "availability_state": "available",
        "overload_signal": "none",
    }
    assert validate_field_ops_status(doc).ok

    bad = dict(doc)
    bad["availability_state"] = "hibernating"
    assert not validate_field_ops_status(bad).ok


def test_sla_aggregation_and_impossible_values() -> None:
    v = Draft202012Validator(json.loads(_SLA_SCHEMA.read_text(encoding="utf-8")))
    ok = {
        "installer_id": "cabcdefghijklmnopqrs012345",
        "window_start": "2026-01-01T00:00:00Z",
        "window_end": "2026-03-01T00:00:00Z",
        "site_visit_completion_rate": 0.9,
        "job_sample_size": 10,
    }
    assert not list(v.iter_errors(ok))

    bad = dict(ok)
    bad["site_visit_completion_rate"] = 1.4
    assert list(v.iter_errors(bad))

    bad2 = dict(ok)
    bad2["response_time_ms_p50"] = -10
    assert list(v.iter_errors(bad2))

    ws = datetime(2026, 3, 1, tzinfo=timezone.utc)
    we = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert ws > we


def test_exporter_correctness(tmp_path: Path) -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "partner_operations.exporters.export_partner_operations",
            "--input",
            str(_FIX_OPS),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=_OPS,
        env={**dict(**__import__("os").environ), "PYTHONPATH": str(_OPS)},
        check=True,
    )
    csv_text = (tmp_path / "partner_operations.csv").read_text(encoding="utf-8")
    assert "partner_profile" in csv_text
    assert "field_ops_status" in csv_text

    subprocess.run(
        [
            sys.executable,
            "-m",
            "partner_operations.exporters.export_partner_sla_metrics",
            "--input",
            str(_FIX_SLA),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=_OPS,
        env={**dict(**__import__("os").environ), "PYTHONPATH": str(_OPS)},
        check=True,
    )
    sla_csv = (tmp_path / "partner_sla_metrics.csv").read_text(encoding="utf-8")
    assert "quote_turnaround_hours_p50" in sla_csv

    row = map_sla_metric_row(json.loads(_FIX_SLA.read_text(encoding="utf-8").strip().splitlines()[0]))
    assert row["job_sample_size"] == 34

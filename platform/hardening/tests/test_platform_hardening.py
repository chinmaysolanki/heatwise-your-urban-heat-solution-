from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

from hardening.mappers.error_mapper import map_audit_event_to_row, map_error_contract_to_row
from hardening.mappers.readiness_mapper import map_readiness_check_to_row
from hardening.validators.validate_audit_event import validate_audit_event
from hardening.validators.validate_error_contract import validate_error_contract
from hardening.validators.validate_readiness_check import validate_readiness_check

_ROOT = Path(__file__).resolve().parent.parent
_AUDIT_FIX = _ROOT / "tests" / "fixtures" / "audit_events.jsonl"
_READY_FIX = _ROOT / "tests" / "fixtures" / "readiness_checks.jsonl"
_IDEMPOTENCY_SCHEMA = _ROOT / "schemas" / "idempotency_schema.json"


def _idempotency_validator() -> Draft202012Validator:
    return Draft202012Validator(json.loads(_IDEMPOTENCY_SCHEMA.read_text(encoding="utf-8")))


def idempotency_policy_violations(doc: dict) -> list[str]:
    errs = [f"{e.json_path}: {e.message}" for e in _idempotency_validator().iter_errors(doc)]
    if doc.get("policy") == "required":
        key = doc.get("idempotency_key")
        if not (isinstance(key, str) and key.strip()):
            errs.append("policy=required demands non-empty idempotency_key")
    return errs


def test_error_contract_validation() -> None:
    ok = {
        "code": "INVALID_BODY",
        "message": "projectId missing",
        "severity": "warning",
        "retriable": False,
        "http_status_hint": 400,
        "subsystem": "recommendation_runtime",
    }
    r = validate_error_contract(ok)
    assert r.ok
    row = map_error_contract_to_row(ok)
    assert row["code"] == "INVALID_BODY"

    bad = dict(ok)
    bad["severity"] = "catastrophic"
    assert not validate_error_contract(bad).ok

    bad2 = {"code": "lowercase", "message": "x"}
    assert not validate_error_contract(bad2).ok


def test_idempotency_schema_and_policy() -> None:
    base = {"scope": "revenue_event", "policy": "optional"}
    assert not list(_idempotency_validator().iter_errors(base))

    req = {"scope": "telemetry_event", "policy": "required", "operation": "log_impression"}
    assert idempotency_policy_violations(req)

    req_ok = {**req, "idempotency_key": "k-1", "request_hash": "sha256:abc"}
    assert not idempotency_policy_violations(req_ok)


def test_audit_event_append_flow() -> None:
    doc = {
        "audit_event_type": "payment.reconcile",
        "subsystem": "integrations",
        "actor_type": "system",
        "action": "nightly_reconcile",
        "outcome": "partial",
        "payload": {"batch": 12},
    }
    r = validate_audit_event(doc)
    assert r.ok
    row = map_audit_event_to_row(doc)
    assert "partial" == row["outcome"]

    bad = dict(doc)
    bad["entity_id"] = "not-a-cuid"
    assert not validate_audit_event(bad).ok

    missing_type = dict(doc)
    missing_type["entity_id"] = "cabcdefghijklmnopqrs012345"
    assert not validate_audit_event(missing_type).ok


def test_readiness_aggregation() -> None:
    checks = [
        {
            "check_id": "a",
            "subsystem": "analytics",
            "status": "pass",
            "latency_ms": 5,
            "message": "ok",
        },
        {
            "check_id": "b",
            "subsystem": "supply",
            "status": "degraded",
            "latency_ms": 200,
            "message": "slow",
        },
    ]
    for c in checks:
        assert validate_readiness_check(c).ok

    overall = "unhealthy" if any(x["status"] == "fail" for x in checks) else "degraded" if any(x["status"] == "degraded" for x in checks) else "healthy"
    assert overall == "degraded"

    bad_structure = {"check_id": "", "subsystem": "pricing", "status": "pass", "latency_ms": 1, "message": "x"}
    assert not validate_readiness_check(bad_structure).ok

    rows = [map_readiness_check_to_row(c) for c in checks]
    assert rows[0]["subsystem"] == "analytics"


def test_exporter_correctness(tmp_path: Path) -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "hardening.exporters.export_audit_events",
            "--input",
            str(_AUDIT_FIX),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=_ROOT.parent,
        env={**dict(**__import__("os").environ), "PYTHONPATH": str(_ROOT.parent)},
        check=True,
    )
    audit_csv = tmp_path / "audit_events.csv"
    assert "quote.submitted" in audit_csv.read_text(encoding="utf-8")

    subprocess.run(
        [
            sys.executable,
            "-m",
            "hardening.exporters.export_readiness_checks",
            "--input",
            str(_READY_FIX),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=_ROOT.parent,
        env={**dict(**__import__("os").environ), "PYTHONPATH": str(_ROOT.parent)},
        check=True,
    )
    ready_csv = tmp_path / "readiness_checks.csv"
    text = ready_csv.read_text(encoding="utf-8")
    assert "retraining_registry" in text
    assert "pricing" in text

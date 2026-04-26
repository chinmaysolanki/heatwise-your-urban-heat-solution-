from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from integrations.mappers.delivery_mapper import map_delivery_status_to_row
from integrations.mappers.integration_mapper import map_integration_event_to_row, map_outbound_sync_preview_row
from integrations.validators.validate_integration_event import validate_integration_event
from integrations.validators.validate_outbound_sync import validate_outbound_sync
from integrations.validators.validate_webhook import validate_webhook, webhook_dedup_key

_ROOT = Path(__file__).resolve().parent.parent
_FIXTURES = _ROOT / "tests" / "fixtures" / "integration_events.jsonl"


def test_integration_event_logging_valid() -> None:
    doc = {
        "event_type": "notification.dispatched",
        "domain": "notification",
        "source_system": "heatwise_core",
        "target_system": "notification_provider",
        "payload": {"template": "heat_alert", "to_hash": "sha256:abc"},
    }
    r = validate_integration_event(doc)
    assert r.ok
    row = map_integration_event_to_row(doc)
    assert row["event_type"] == "notification.dispatched"
    assert "payload_json" in row


def test_integration_event_invalid_domain_and_payload() -> None:
    r = validate_integration_event({"event_type": "x", "domain": "unknown", "payload": {}})
    assert not r.ok
    r2 = validate_integration_event({"event_type": "x", "domain": "internal", "payload": []})
    assert not r2.ok


def test_outbound_sync_preview_mapper() -> None:
    doc = {
        "target_system": "crm_sink",
        "entity_type": "RecommendationDossier",
        "entity_id": "cabcdefghijklmnopqrs012345",
        "payload_snapshot": {"title": "Q1", "rows": 12},
    }
    r = validate_outbound_sync(doc)
    assert r.ok
    row = map_outbound_sync_preview_row(doc)
    assert row["payload_byte_length"] > 0
    assert "rows" in row["payload_top_level_keys"]


def test_outbound_sync_bad_retry_metadata() -> None:
    now = datetime(2026, 3, 28, 12, 0, 0, tzinfo=timezone.utc)
    past = (now - timedelta(hours=1)).isoformat()
    r = validate_outbound_sync(
        {
            "target_system": "analytics_sink",
            "entity_type": "t",
            "entity_id": "id",
            "payload_snapshot": {},
            "attempt_count": -1,
            "next_retry_at": past,
        },
        now=now,
    )
    assert not r.ok
    assert any("attempt_count" in e or "next_retry_at" in e for e in r.errors)


def test_webhook_validation_and_duplicate_hook() -> None:
    w = {
        "source_system": "installer_partner_api",
        "external_event_id": "partner-msg-77",
        "event_type": "install.completed",
        "payload": {"job_ref": "J1"},
    }
    assert validate_webhook(w).ok
    assert webhook_dedup_key(w) == ("installer_partner_api", "partner-msg-77")

    bad = dict(w)
    bad["payload"] = [1, 2]
    assert not validate_webhook(bad).ok

    dup_only = {k: v for k, v in w.items() if k != "external_event_id"}
    dup_only["duplicate_of_webhook_id"] = "wh_1"
    assert not validate_webhook(dup_only).ok


def test_webhook_dedup_key_requires_external_id() -> None:
    doc = {
        "source_system": "generic_webhook_source",
        "event_type": "ping",
        "payload": {},
    }
    assert validate_webhook(doc).ok
    assert webhook_dedup_key(doc) is None


def test_webhook_invalid_source_system() -> None:
    r = validate_webhook(
        {
            "source_system": "salesforce_prod_hardcoded",
            "event_type": "x",
            "payload": {},
        }
    )
    assert not r.ok


def test_delivery_status_invalid_state() -> None:
    from jsonschema import Draft202012Validator

    schema_path = _ROOT / "schemas" / "delivery_status_schema.json"
    v = Draft202012Validator(json.loads(schema_path.read_text(encoding="utf-8")))
    doc = {
        "delivery_type": "report",
        "channel": "email",
        "target_ref": "user@example.com",
        "delivery_status": "shipped_typo",
    }
    errs = list(v.iter_errors(doc))
    assert errs


def test_delivery_mapper_row() -> None:
    row = map_delivery_status_to_row(
        {
            "delivery_type": "summary_digest",
            "channel": "push",
            "target_ref": "device:abc",
            "delivery_status": "delivered",
            "last_status_detail": {"provider": "fcm", "latency_ms": 40},
        }
    )
    assert "fcm" in row["last_status_detail_json"]


def test_exporter_correctness(tmp_path: Path) -> None:
    lines = [ln for ln in _FIXTURES.read_text(encoding="utf-8").splitlines() if ln.strip()]
    assert len(lines) == 2
    out = tmp_path / "integration_events.csv"
    subprocess.run(
        [
            sys.executable,
            "-m",
            "integrations.exporters.export_integration_events",
            "--input",
            str(_FIXTURES),
            "--out-dir",
            str(tmp_path),
        ],
        cwd=_ROOT.parent,
        env={**dict(**__import__("os").environ), "PYTHONPATH": str(_ROOT.parent)},
        check=True,
    )
    text = out.read_text(encoding="utf-8")
    assert "crm.lead_synced" in text
    assert "payment.capture_requested" in text

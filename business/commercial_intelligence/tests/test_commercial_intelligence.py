from __future__ import annotations

from commercial_intelligence.validators.validate_commercial_outcome import validate_commercial_outcome
from commercial_intelligence.validators.validate_lead_funnel_event import (
    validate_funnel_sequence_sorted,
    validate_lead_funnel_event,
)
from commercial_intelligence.validators.validate_revenue_event import validate_revenue_event
from commercial_intelligence.validators.validate_unit_economics_snapshot import validate_unit_economics_snapshot


def test_revenue_event_valid() -> None:
    p = {
        "revenue_event_id": "r1",
        "event_type": "design_fee",
        "event_timestamp": "2026-03-01T00:00:00Z",
        "currency": "INR",
        "revenue_status": "recorded",
        "revenue_source": "stripe",
        "gross_amount": 5000,
        "net_amount": 4500,
    }
    r = validate_revenue_event(p)
    assert r.ok


def test_revenue_rejects_net_gt_gross() -> None:
    p = {
        "revenue_event_id": "r2",
        "event_type": "consultation_fee",
        "event_timestamp": "2026-03-01T00:00:00Z",
        "currency": "INR",
        "revenue_status": "recorded",
        "revenue_source": "stripe",
        "gross_amount": 100,
        "net_amount": 500,
    }
    r = validate_revenue_event(p)
    assert not r.ok


def test_funnel_sequence_rejects_backwards() -> None:
    ev = [
        {"funnel_stage": "quote_accepted", "event_timestamp": "2026-03-01T12:00:00Z"},
        {"funnel_stage": "quote_received", "event_timestamp": "2026-03-01T13:00:00Z"},
    ]
    r = validate_funnel_sequence_sorted(ev)
    assert not r.ok


def test_funnel_sequence_ok() -> None:
    ev = [
        {"funnel_stage": "quote_received", "event_timestamp": "2026-03-01T12:00:00Z"},
        {"funnel_stage": "quote_accepted", "event_timestamp": "2026-03-01T13:00:00Z"},
    ]
    r = validate_funnel_sequence_sorted(ev)
    assert r.ok


def test_commercial_outcome_time_order() -> None:
    p = {
        "commercial_outcome_id": "co1",
        "project_id": "p",
        "quotes_received_count": 1,
        "commercial_status": "quoted",
        "first_quote_received_at": "2026-03-02T00:00:00Z",
        "quote_accepted_at": "2026-03-01T00:00:00Z",
    }
    r = validate_commercial_outcome(p)
    assert not r.ok


def test_unit_economics_window() -> None:
    p = {
        "unit_economics_snapshot_id": "u1",
        "window_start": "2026-02-01T00:00:00Z",
        "window_end": "2026-01-01T00:00:00Z",
        "total_projects": 1,
        "total_quote_requests": 1,
        "total_quotes_received": 1,
        "total_quote_acceptances": 1,
        "total_installs_completed": 0,
        "created_at": "2026-03-01T00:00:00Z",
    }
    r = validate_unit_economics_snapshot(p)
    assert not r.ok


def test_lead_funnel_schema() -> None:
    p = {
        "lead_funnel_event_id": "l1",
        "event_type": "milestone",
        "event_timestamp": "2026-03-01T00:00:00Z",
        "project_id": "p",
        "funnel_stage": "install_completed",
    }
    assert validate_lead_funnel_event(p).ok

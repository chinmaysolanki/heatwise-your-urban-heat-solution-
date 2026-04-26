from __future__ import annotations

from admin_analytics.aggregations.cohort_metrics import aggregate_cohort_metrics, extract_cohort
from admin_analytics.aggregations.experiment_metrics import aggregate_experiment_metrics
from admin_analytics.aggregations.installer_outcome_metrics import aggregate_installer_outcomes
from admin_analytics.aggregations.recommendation_funnel import aggregate_recommendation_funnel
from admin_analytics.exporters.export_admin_metrics import build_export


def test_funnel_basic() -> None:
    sessions = [{"id": "s1"}, {"id": "s2"}]
    events = [
        {"sessionId": "s1", "eventType": "recommendation_impression"},
        {"sessionId": "s1", "eventType": "recommendation_expand"},
        {"sessionId": "s1", "eventType": "recommendation_save"},
        {"sessionId": "s2", "eventType": "recommendation_impression"},
    ]
    f = aggregate_recommendation_funnel(sessions, events, install_completed_count=1)
    assert f["unique_sessions"]["sessions_generated"] == 2
    assert f["unique_sessions"]["impression"] == 2
    assert f["unique_sessions"]["expand"] == 1
    assert f["unique_sessions"]["save"] == 1


def test_installer_outcomes() -> None:
    rows = [
        {"installStatus": "completed", "userSatisfactionScore": 4.0},
        {"installStatus": "completed", "userSatisfactionScore": 5.0},
        {"installStatus": "cancelled"},
    ]
    o = aggregate_installer_outcomes(rows)
    assert o["completed_count"] == 2
    assert o["avg_user_satisfaction"] == 4.5


def test_experiment_metrics() -> None:
    sessions = [
        {"id": "a", "generatorSource": "hybrid", "rulesVersion": "r1", "latencyMs": 100},
        {"id": "b", "generatorSource": "hybrid", "rulesVersion": "r1", "latencyMs": 300},
    ]
    ev = {
        "a": {"recommendation_impression": 1, "recommendation_select": 1},
        "b": {"recommendation_view": 2},
    }
    m = aggregate_experiment_metrics(sessions, ev)
    assert len(m["by_variant"]) == 1
    assert m["by_variant"][0]["session_count"] == 2
    assert m["by_variant"][0]["median_latency_ms"] == 200.0


def test_cohort_extract() -> None:
    c = extract_cohort(
        '{"projectType": "balcony"}',
        '{"budgetRange": "medium"}',
        '{"climateZone": "tropical"}',
    )
    assert c["project_type"] == "balcony"
    assert c["climate_zone"] == "tropical"
    assert c["budget_band"] == "medium"


def test_build_export_integration() -> None:
    pj = '{"projectType": "roof"}'
    bundle = {
        "sessions": [
            {
                "id": "s1",
                "generatorSource": "hybrid",
                "rulesVersion": "r1",
                "latencyMs": 50,
                "projectSnapshotJson": pj,
                "preferenceSnapshotJson": "{}",
                "environmentSnapshotJson": '{"climateZone": "arid"}',
            },
        ],
        "events": [{"sessionId": "s1", "eventType": "recommendation_impression"}],
        "install_outcomes": [{"installStatus": "completed"}],
    }
    out = build_export(bundle)
    assert out["schema_version"] == "admin_metrics.v1"
    assert out["recommendation_funnel"]["unique_sessions"]["sessions_generated"] == 1


def test_cohort_metrics_with_enriched_events() -> None:
    events = [
        {
            "sessionId": "s1",
            "eventType": "recommendation_impression",
            "projectSnapshotJson": '{"projectType": "x"}',
            "preferenceSnapshotJson": "{}",
            "environmentSnapshotJson": "{}",
        },
    ]
    rows = aggregate_cohort_metrics(events)
    assert rows[0]["project_type"] == "x"
    assert rows[0]["sessions"] == 1

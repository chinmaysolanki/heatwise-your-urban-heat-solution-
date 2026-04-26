from __future__ import annotations

from pricing_intelligence.validators.validate_budget_fit import validate_budget_fit_record
from pricing_intelligence.validators.validate_cost_estimate import validate_cost_estimate_record
from pricing_intelligence.validators.validate_quote_comparison import validate_quote_comparison_record


def test_install_triplet_order() -> None:
    errs = validate_cost_estimate_record(
        {
            "cost_estimate_id": "c1",
            "region": "R",
            "climate_zone": "Z",
            "project_type": "rooftop",
            "solution_type": "planter",
            "estimate_source": "hybrid",
            "estimated_install_cost_min_inr": 100,
            "estimated_install_cost_median_inr": 80,
            "estimated_install_cost_max_inr": 120,
            "estimated_annual_maintenance_min_inr": 10,
            "estimated_annual_maintenance_median_inr": 12,
            "estimated_annual_maintenance_max_inr": 15,
            "estimate_confidence_band": "medium",
            "quote_volatility_score": 0.3,
            "estimate_generated_at": "2026-01-01T00:00:00Z",
        },
    )
    assert any("min <= median <= max" in e for e in errs)


def test_valid_cost_estimate() -> None:
    assert (
        validate_cost_estimate_record(
            {
                "cost_estimate_id": "c1",
                "region": "R",
                "climate_zone": "Z",
                "project_type": "rooftop",
                "solution_type": "planter:pergola",
                "estimate_source": "rules",
                "estimated_install_cost_min_inr": 200_000,
                "estimated_install_cost_median_inr": 260_000,
                "estimated_install_cost_max_inr": 330_000,
                "estimated_annual_maintenance_min_inr": 20_000,
                "estimated_annual_maintenance_median_inr": 28_000,
                "estimated_annual_maintenance_max_inr": 38_000,
                "estimate_confidence_band": "wide",
                "quote_volatility_score": 0.4,
                "contingency_pct": 8,
                "estimate_generated_at": "2026-01-01T00:00:00Z",
            },
        )
        == []
    )


def test_quote_comparison_flags_json() -> None:
    errs = validate_quote_comparison_record(
        {
            "quote_comparison_id": "q1",
            "project_id": "p1",
            "comparison_generated_at": "2026-01-01T00:00:00Z",
            "cost_risk_flags_json": "not-json",
        },
    )
    assert any("cost_risk_flags_json" in e for e in errs)


def test_budget_fit_stretch_consistency() -> None:
    errs = validate_budget_fit_record(
        {
            "budget_fit_id": "b1",
            "project_id": "p1",
            "user_budget_inr": 100_000,
            "estimated_install_cost_median_inr": 90_000,
            "estimated_install_cost_max_inr": 120_000,
            "budget_fit_band": "stretch_required",
            "stretch_budget_required": False,
            "budget_fit_score": 0.5,
            "affordability_risk_level": "medium",
            "created_at": "2026-01-01T00:00:00Z",
        },
    )
    assert any("stretch_required" in e for e in errs)

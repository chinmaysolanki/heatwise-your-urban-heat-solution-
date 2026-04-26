from __future__ import annotations

from supply_intelligence.validators.validate_recommendation_constraint import validate_recommendation_constraint_record
from supply_intelligence.validators.validate_seasonal_window import month_range_valid, validate_seasonal_window_record
from supply_intelligence.validators.validate_species_availability import substitute_cycle_exists, validate_species_availability_record


def test_month_range_wrap_ok() -> None:
    assert month_range_valid(11, 3)
    assert validate_seasonal_window_record(
        {
            "seasonal_window_id": "w1",
            "region": "X",
            "climate_zone": "Z",
            "start_month": 11,
            "end_month": 3,
            "suitability_level": "marginal",
        },
    ) == []


def test_species_invalid_enum() -> None:
    errs = validate_species_availability_record(
        {
            "availability_id": "a",
            "species_name": "S",
            "region": "R",
            "supplier_source_type": "x",
            "availability_status": "nope",
            "availability_confidence": 1.2,
            "updated_at": "2026-01-01T00:00:00Z",
        },
    )
    assert any("availability_status" in e for e in errs)
    assert any("availability_confidence" in e for e in errs)


def test_substitute_self_cycle() -> None:
    assert substitute_cycle_exists("Rose", '["Rose"]')
    assert not substitute_cycle_exists("Rose", '["Tulip"]')


def test_constraint_snapshot_scores() -> None:
    errs = validate_recommendation_constraint_record(
        {
            "constraint_snapshot_id": "c",
            "region": "R",
            "climate_zone": "Z",
            "month_of_year": 13,
            "constraint_flags_json": "{}",
            "blocked_species_json": "[]",
            "blocked_materials_json": "[]",
            "blocked_solution_types_json": "[]",
            "allowed_substitutions_json": "{}",
            "supply_readiness_score": 2,
            "seasonal_readiness_score": 0.5,
            "generated_at": "2026-01-01T00:00:00Z",
        },
    )
    assert any("month_of_year" in e for e in errs)
    assert any("supply_readiness_score" in e for e in errs)

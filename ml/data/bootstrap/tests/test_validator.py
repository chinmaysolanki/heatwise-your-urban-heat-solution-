"""Dataset validator catches structural and heuristic violations."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from synthetic_bootstrap.bootstrap_env import load_validation_rules
from synthetic_bootstrap.species_loader import SpeciesConfigError, load_species_library_json
from validators.dataset_validator import validate_dataset_files


def _minimal_rules() -> dict:
    return load_validation_rules(Path(__file__).resolve().parent.parent / "config")


def test_validator_flags_bad_ranks(tmp_path: Path) -> None:
    projects = pd.DataFrame(
        {
            "project_id": ["P1"],
            "sample_id": ["P1"],
            "project_type": ["balcony"],
            "city_tier": ["tier_1"],
            "climate_zone": ["tropical_humid"],
            "region": ["Other"],
            "area_sqft": [200.0],
            "usable_area_pct": [70.0],
            "sunlight_hours": [6.0],
            "shade_level": ["low"],
            "floor_level": [5],
            "wind_exposure": [0.5],
            "load_capacity_level": ["medium"],
            "railing_height_ft": [3.5],
            "waterproofing_status": ["good"],
            "drainage_quality": ["ok"],
            "access_ease": ["easy"],
            "surface_type": ["concrete"],
            "roof_material": ["rcc"],
            "ambient_heat_severity": ["moderate"],
            "avg_summer_temp_c": [34.0],
            "humidity_pct": [50],
            "rainfall_level": ["moderate"],
            "air_quality_level": ["moderate"],
            "dust_exposure": ["medium"],
            "water_availability": ["adequate"],
            "irrigation_possible": [1],
            "orientation": ["S"],
            "surrounding_built_density": ["high"],
            "budget_inr": [80000],
            "maintenance_preference": ["low"],
            "aesthetic_style": ["minimal_modern"],
            "purpose_primary": ["cooling"],
            "child_pet_safe_required": [0],
            "edible_plants_preferred": [0],
            "flowering_preferred": [0],
            "privacy_required": [0],
            "seating_required": [0],
            "shade_required": [0],
            "biodiversity_priority": [0],
            "native_species_preference": [0],
        },
    )
    candidates = pd.DataFrame(
        {
            "candidate_id": ["P1-C00", "P1-C01"],
            "project_id": ["P1", "P1"],
            "rank_position": [1, 1],
            "best_candidate": [1, 0],
            "recommendation_type": ["planters_only", "planters_only"],
            "greenery_density": ["moderate", "moderate"],
            "planter_type": ["terracotta", "terracotta"],
            "irrigation_type": ["manual_watering", "manual_watering"],
            "shade_solution": ["none", "none"],
            "cooling_strategy": ["evapotranspiration_light", "evapotranspiration_light"],
            "maintenance_level_pred": ["L1_light", "L1_light"],
            "estimated_install_cost_inr": [20000.0, 20000.0],
            "estimated_annual_maintenance_inr": [2000.0, 2000.0],
            "expected_temp_reduction_c": [5.0, 4.0],
            "expected_surface_temp_reduction_c": [8.0, 7.0],
            "pollinator_support_score": [0.5, 0.5],
            "privacy_score": [0.2, 0.2],
            "feasibility_score": [0.8, 0.8],
            "safety_score": [0.9, 0.9],
            "recommendation_acceptance_likelihood": [0.7, 0.5],
            "long_term_success_likelihood": [0.6, 0.4],
            "heat_mitigation_score": [0.6, 0.5],
            "water_efficiency_score": [0.7, 0.6],
            "overall_recommendation_score": [0.8, 0.4],
            "species_primary": ["A", "B"],
            "species_secondary": ["A", "B"],
            "species_tertiary": ["A", "B"],
            "species_mix_type": ["single_species", "single_species"],
            "species_count_estimate": [1, 1],
        },
    )
    pairs = pd.DataFrame(
        {
            "project_id": ["P1"],
            "preferred_candidate_id": ["P1-C00"],
            "other_candidate_id": ["P1-C01"],
            "preference_label": [1],
        },
    )
    raw = tmp_path / "raw"
    raw.mkdir()
    projects.to_csv(raw / "projects.csv", index=False)
    candidates.to_csv(raw / "candidates.csv", index=False)
    pairs.to_csv(raw / "ranking_pairs.csv", index=False)
    rep = validate_dataset_files(
        raw / "projects.csv",
        raw / "candidates.csv",
        raw / "ranking_pairs.csv",
        None,
        _minimal_rules(),
    )
    assert rep.failed_checks > 0


def test_species_json_invalid_raises(tmp_path: Path) -> None:
    p = tmp_path / "species_library.json"
    p.write_text("{not json", encoding="utf-8")
    with pytest.raises(SpeciesConfigError):
        load_species_library_json(p)

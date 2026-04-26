from __future__ import annotations

from serving.species.catalog_code_resolve import (
    resolve_catalog_code_from_ml_or_display_label,
)
from serving.orchestration.recommendation_orchestrator import run_recommendation_request


def test_resolve_money_plant_to_pothos() -> None:
    assert resolve_catalog_code_from_ml_or_display_label("Money Plant") == "pothos"


def test_resolve_curry_leaf_title_case() -> None:
    assert resolve_catalog_code_from_ml_or_display_label("Curry Leaf") == "curry_leaf"


def test_resolve_direct_snake_code() -> None:
    assert resolve_catalog_code_from_ml_or_display_label("spider_plant") == "spider_plant"


def test_unknown_label_not_invented() -> None:
    assert resolve_catalog_code_from_ml_or_display_label("Totally Fictional Plantius") is None


def test_periwinkle_vinca_display_matches_catalog() -> None:
    assert resolve_catalog_code_from_ml_or_display_label("Periwinkle (Vinca)") == "vinca"


def test_orchestrator_attaches_catalog_code(tmp_path) -> None:
    payload = {
        "project": {"project_type": "rooftop", "budget_inr": 200_000, "load_capacity_level": "medium"},
        "environment": {"water_availability": "moderate"},
        "preferences": {"purpose_primary": "cooling"},
        "maxCandidates": 6,
        "registryDir": str(tmp_path),
    }
    out = run_recommendation_request(payload)
    by_species = {
        str(c["candidatePayload"].get("species_primary")): c["candidatePayload"].get("species_catalog_code")
        for c in out["candidates"]
    }
    assert by_species.get("Money Plant") == "pothos"
    assert by_species.get("Bougainvillea") == "bougainvillea"
    assert by_species.get("Periwinkle (Vinca)") == "vinca"
    assert any("species_catalog_code" in c["candidatePayload"] for c in out["candidates"])

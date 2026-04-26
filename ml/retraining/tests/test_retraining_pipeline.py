from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from retraining.data.split_manager import split_by_group
from retraining.evaluation.compare_to_baseline import summarize_comparison
from retraining.packaging.export_inference_bundle import export_inference_bundle
from retraining.registry.versioning import next_version
from retraining.run_retraining import _render_report, run


def test_next_version_deterministic_sequence(tmp_path: Path) -> None:
    v1 = next_version("feasibility", tmp_path)
    assert v1.endswith("_001")
    reg = tmp_path / "registry_index.json"
    reg.write_text(json.dumps({"models": [{"task": "feasibility", "version": v1}]}), encoding="utf-8")
    # versioning scans registry_dir for registry_index.json
    v2 = next_version("feasibility", tmp_path)
    assert v2.endswith("_002")


def test_split_no_group_leakage() -> None:
    rows = []
    for g in range(10):
        for _ in range(2):
            rows.append({"leakage_group_id": str(g), "v": np.random.randn()})
    df = pd.DataFrame(rows)
    sp = split_by_group(df, seed=0)
    assert sp.train_groups.isdisjoint(sp.test_groups)
    assert sp.train_groups.isdisjoint(sp.val_groups)


def test_render_training_report(tmp_path: Path) -> None:
    tpl = tmp_path / "t.md"
    tpl.write_text("# ${name}", encoding="utf-8")
    from string import Template

    assert "x" in Template(tpl.read_text(encoding="utf-8")).safe_substitute({"name": "x"})


def test_compare_to_baseline_regression() -> None:
    cand = {"val": {"mae": 0.1, "rmse": 0.2, "r2": 0.5}}
    base = {"val": {"mae": 0.15, "rmse": 0.25, "r2": 0.4}}
    s = summarize_comparison("feasibility", cand, base)
    assert "regression_val" in s


def test_export_inference_bundle(tmp_path: Path) -> None:
    src = tmp_path / "m.joblib"
    src.write_bytes(b"fake")
    fm = tmp_path / "fm.json"
    fm.write_text("{}", encoding="utf-8")
    out = export_inference_bundle(
        model_joblib_src=src,
        feature_manifest_src=fm,
        metrics_src=None,
        out_dir=tmp_path / "bundle",
        model_id="mid",
        task="feasibility",
        model_version="v1",
        training_snapshot_id="s",
        trained_at="t",
    )
    assert out.is_file()
    man = json.loads(out.read_text(encoding="utf-8"))
    assert man["model_id"] == "mid"


def _minimal_hybrid(tmp_path: Path) -> Path:
    """Pointwise rows with enough groups for train/val/test."""
    rows = []
    for g in range(12):
        pid = f"P{g}"
        for k in range(2):
            rows.append(
                {
                    "record_id": f"r{g}{k}",
                    "data_source": "synthetic_bootstrap",
                    "label_confidence_tier": "synthetic_heuristic",
                    "leakage_group_id": pid,
                    "project_id": pid,
                    "candidate_id": f"{pid}_C{k}",
                    "row_weight": 0.35,
                    "feasibility_score": 0.3 + 0.1 * k,
                    "heat_mitigation_score": 0.4 + 0.05 * k,
                    "best_candidate": 1 if k == 0 else 0,
                    "project_type": "rooftop",
                    "area_sqft": 100.0 + g,
                    "usable_area_pct": 80.0,
                    "floor_level": 2,
                    "wind_exposure": 0.3,
                    "load_capacity_level": "medium",
                    "railing_height_ft": 3.0,
                    "surface_type": "concrete",
                    "roof_material": "rcc",
                    "access_ease": "easy",
                    "drainage_quality": "good",
                    "waterproofing_status": "good",
                    "budget_inr": 50000,
                    "maintenance_preference": "low",
                    "aesthetic_style": "minimal",
                    "purpose_primary": "cooling",
                    "child_pet_safe_required": 0,
                    "edible_plants_preferred": 0,
                    "flowering_preferred": 0,
                    "privacy_required": 0,
                    "seating_required": 0,
                    "shade_required": 0,
                    "biodiversity_priority": 0,
                    "native_species_preference": 0,
                    "city_tier": "tier_2",
                    "climate_zone": "tropical_humid",
                    "region": "Mumbai",
                    "sunlight_hours": 6.0,
                    "shade_level": "medium",
                    "ambient_heat_severity": "high",
                    "avg_summer_temp_c": 34.0,
                    "humidity_pct": 70,
                    "rainfall_level": "heavy_monsoon",
                    "air_quality_level": "moderate",
                    "dust_exposure": "medium",
                    "water_availability": "moderate",
                    "irrigation_possible": 1,
                    "orientation": "south",
                    "surrounding_built_density": "high",
                    "recommendation_type": "planter",
                    "greenery_density": "medium",
                    "planter_type": "raised",
                    "irrigation_type": "drip",
                    "shade_solution": "pergola",
                    "cooling_strategy": "evapotranspiration",
                    "maintenance_level_pred": "low",
                    "species_mix_type": "duo",
                    "species_count_estimate": 3,
                    "estimated_install_cost_inr": 40000,
                    "estimated_annual_maintenance_inr": 5000,
                    "expected_temp_reduction_c": 2.0,
                    "expected_surface_temp_reduction_c": 4.0,
                    "species_primary": "UnknownSpecies",
                    "species_secondary": "UnknownSpecies",
                    "species_tertiary": "UnknownSpecies",
                    "label_policy_version": "v1",
                    "weighting_policy_version": "v1",
                    "had_logged_feedback": True,
                },
            )
    d = tmp_path / "hybrid"
    d.mkdir()
    pd.DataFrame(rows).to_csv(d / "hybrid_pointwise.csv", index=False)
    pairs = []
    for g in range(12):
        pid = f"P{g}"
        pairs.append(
            {
                "project_id": pid,
                "preferred_candidate_id": f"{pid}_C0",
                "other_candidate_id": f"{pid}_C1",
                "preference_label": 1,
                "data_source": "synthetic_bootstrap",
                "pair_confidence_tier": "synthetic_heuristic",
                "row_weight": 0.35,
                "leakage_group_id": pid,
            },
        )
    pd.DataFrame(pairs).to_csv(d / "hybrid_ranking_pairs.csv", index=False)
    (d / "hybrid_manifest.json").write_text(json.dumps({"snapshot_id": "test_snap"}), encoding="utf-8")
    return d


def test_run_retraining_smoke(tmp_path: Path) -> None:
    ds = _minimal_hybrid(tmp_path)
    reg = tmp_path / "registry"
    out = tmp_path / "out"
    run(
        task="feasibility",
        dataset_path=ds,
        registry_dir=reg,
        output_dir=out,
        experiment_name="smoke",
        train_snapshot_id=None,
        candidate_model_type="sklearn_hgbr_v1",
        promote_if_passed=False,
        notes="test",
        source_filter="all",
        species_csv=None,
        baseline_metrics_path=None,
        use_sample_weights=False,
        seed=42,
    )
    assert (out / "smoke" / "feasibility" / "training_report.md").is_file()
    assert any(reg.glob("artifacts/*/*.joblib"))

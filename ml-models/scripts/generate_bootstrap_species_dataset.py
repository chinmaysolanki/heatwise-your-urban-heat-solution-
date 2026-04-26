#!/usr/bin/env python3
"""
HeatWise — synthetic bootstrap dataset for species multi-label training.

Produces CSV aligned with lib/ml/trainingExport.js feature columns plus species_<code>
targets. Labels are rule-based from species traits (see SPECIES_TRAITS), not random.

Keep SPECIES_TRAITS in sync with: prisma/data/species_catalog_seed.mjs

Outputs:
  - data/bootstrap_species_training.csv
  - data/bootstrap_species_training.meta.json (provenance)

Training: exclude synthetic-only column, e.g.
  python scripts/train_species_model.py --data data/bootstrap_species_training.csv \\
    --exclude-cols data_source
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

# Must match heatwise/lib/ml/trainingExport.js (order matters).
FEATURE_COLUMNS = [
    "space_type",
    "area_sqm",
    "length_m",
    "width_m",
    "sunlight_hours",
    "shade_level",
    "wind_exposure",
    "water_access",
    "drainage_quality",
    "avg_day_temp_c",
    "peak_surface_temp_c",
    "humidity_pct",
    "rainfall_level",
    "heat_island_score",
    "maintenance_level",
    "budget_level",
    "preferred_style",
    "edible_preference",
    "flowering_preference",
    "pet_safe_required",
    "irrigation_allowed",
]

# Sync with prisma/data/species_catalog_seed.mjs (codes + rule flags + sun window).
SPECIES_TRAITS: list[dict] = [
    {"code": "tulsi_holy", "edible": True, "flowering": True, "pet_safe": True, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 4, "max_sun": 10},
    {"code": "basil_sweet", "edible": True, "flowering": True, "pet_safe": True, "drought_tolerant": False, "heat_tolerant": True, "low_maintenance": True, "min_sun": 4, "max_sun": 8},
    {"code": "mint", "edible": True, "flowering": True, "pet_safe": True, "drought_tolerant": False, "heat_tolerant": True, "low_maintenance": True, "min_sun": 3, "max_sun": 6},
    {"code": "coriander", "edible": True, "flowering": True, "pet_safe": True, "drought_tolerant": False, "heat_tolerant": False, "low_maintenance": True, "min_sun": 3, "max_sun": 5},
    {"code": "curry_leaf", "edible": True, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 6, "max_sun": 10},
    {"code": "lemongrass", "edible": True, "flowering": False, "pet_safe": True, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 6, "max_sun": 10},
    {"code": "cherry_tomato", "edible": True, "flowering": True, "pet_safe": False, "drought_tolerant": False, "heat_tolerant": True, "low_maintenance": False, "min_sun": 6, "max_sun": 10},
    {"code": "chilli", "edible": True, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 6, "max_sun": 10},
    {"code": "malabar_spinach", "edible": True, "flowering": True, "pet_safe": True, "drought_tolerant": False, "heat_tolerant": True, "low_maintenance": True, "min_sun": 4, "max_sun": 8},
    {"code": "aloe_vera", "edible": False, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 4, "max_sun": 10},
    {"code": "jade_plant", "edible": False, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 4, "max_sun": 8},
    {"code": "sedum", "edible": False, "flowering": True, "pet_safe": True, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 6, "max_sun": 12},
    {"code": "prickly_pear", "edible": True, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 8, "max_sun": 12},
    {"code": "bougainvillea", "edible": False, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 8, "max_sun": 12},
    {"code": "hibiscus", "edible": False, "flowering": True, "pet_safe": False, "drought_tolerant": False, "heat_tolerant": True, "low_maintenance": False, "min_sun": 6, "max_sun": 10},
    {"code": "marigold", "edible": True, "flowering": True, "pet_safe": True, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 6, "max_sun": 10},
    {"code": "portulaca", "edible": False, "flowering": True, "pet_safe": True, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 6, "max_sun": 12},
    {"code": "vinca", "edible": False, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 4, "max_sun": 10},
    {"code": "zinnia", "edible": True, "flowering": True, "pet_safe": True, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 6, "max_sun": 12},
    {"code": "pothos", "edible": False, "flowering": False, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 2, "max_sun": 6},
    {"code": "snake_plant", "edible": False, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 2, "max_sun": 8},
    {"code": "spider_plant", "edible": False, "flowering": True, "pet_safe": True, "drought_tolerant": False, "heat_tolerant": True, "low_maintenance": True, "min_sun": 3, "max_sun": 6},
    {"code": "geranium_pelargonium", "edible": True, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 6, "max_sun": 10},
    {"code": "plumeria", "edible": False, "flowering": True, "pet_safe": False, "drought_tolerant": True, "heat_tolerant": True, "low_maintenance": True, "min_sun": 8, "max_sun": 12},
]


def _repo_ml_root() -> Path:
    return Path(__file__).resolve().parent.parent


def _water_stress_index(
    water_access: str,
    irrigation_allowed: int,
    rainfall_level: str,
) -> float:
    """0 = easy water, 1 = harsh / rooftop water stress."""
    wa_map = {
        "HOSE_ON_DECK": 0.05,
        "SPOUT_NEAR": 0.2,
        "CARRY_BUCKETS": 0.55,
        "RAIN_ONLY": 0.88,
    }
    s = wa_map.get(water_access, 0.35)
    if irrigation_allowed == 0:
        s += 0.22
    if rainfall_level == "DRY":
        s += 0.12
    elif rainfall_level == "HEAVY":
        s -= 0.18
    return float(min(1.0, max(0.0, s)))


def _shade_from_sun(sun_hours: float, rng: random.Random) -> str:
    if sun_hours < 3.5:
        return rng.choice(["HIGH", "HIGH", "MEDIUM"])
    if sun_hours < 6:
        return rng.choice(["MEDIUM", "MEDIUM", "LOW"])
    return rng.choice(["LOW", "LOW", "MEDIUM"])


def sample_feature_row(rng: random.Random) -> dict:
    """Realistic rooftop / balcony scenarios (hot urban India–style ranges)."""
    space_type = rng.choices(
        [
            "ROOFTOP_outdoor",
            "TERRACE_outdoor",
            "BALCONY_outdoor",
            "BALCONY_indoor",
            "ROOFTOP_indoor",
        ],
        weights=[0.35, 0.25, 0.28, 0.08, 0.04],
        k=1,
    )[0]

    if "indoor" in space_type:
        sun_lo, sun_hi = 1.5, 5.5
    elif "BALCONY" in space_type:
        sun_lo, sun_hi = 3.0, 9.0
    else:
        sun_lo, sun_hi = 5.0, 11.5
    sunlight_hours = round(rng.uniform(sun_lo, sun_hi), 1)

    area_sqm = round(rng.lognormvariate(math.log(4), 0.65), 2)
    area_sqm = max(1.5, min(area_sqm, 85.0))
    side = math.sqrt(area_sqm)
    length_m = round(side * rng.uniform(0.85, 1.25), 2)
    width_m = round(area_sqm / max(length_m, 0.1), 2)

    water_access = rng.choices(
        ["HOSE_ON_DECK", "SPOUT_NEAR", "CARRY_BUCKETS", "RAIN_ONLY"],
        weights=[0.18, 0.32, 0.38, 0.12],
        k=1,
    )[0]

    rainfall_level = rng.choices(
        ["DRY", "MODERATE", "HEAVY"],
        weights=[0.35, 0.45, 0.20],
        k=1,
    )[0]

    avg_day_temp_c = round(rng.uniform(28.0, 40.5), 1)
    peak_surface_temp_c = round(avg_day_temp_c + rng.uniform(6.0, 20.0), 1)

    humidity_pct = int(round(rng.uniform(32.0, 88.0)))
    heat_island_score = round(rng.uniform(0.35, 0.96), 3)
    wind_exposure = round(rng.uniform(0.08, 0.95), 3)

    maintenance_level = rng.choices([0, 1, 2, 3], weights=[0.2, 0.35, 0.3, 0.15], k=1)[0]
    budget_level = rng.choices([0, 1, 2, 3], weights=[0.15, 0.35, 0.35, 0.15], k=1)[0]

    preferred_style = rng.choices(
        [
            "food_garden",
            "ornamental_color",
            "cooling_green",
            "mixed_edible_ornamental",
            "minimal_low_care",
        ],
        weights=[0.28, 0.22, 0.2, 0.22, 0.08],
        k=1,
    )[0]

    edible_preference = 1 if rng.random() < 0.55 else 0
    flowering_preference = 1 if rng.random() < 0.5 else 0
    pet_safe_required = 1 if rng.random() < 0.22 else 0
    irrigation_allowed = 1 if rng.random() < 0.72 else 0

    # Correlate preferences slightly with style
    if preferred_style == "food_garden" and rng.random() < 0.55:
        edible_preference = 1
    if preferred_style == "ornamental_color" and rng.random() < 0.5:
        flowering_preference = 1

    drainage_quality = rng.choices(
        ["POOR", "OK", "GOOD"],
        weights=[0.18, 0.42, 0.40],
        k=1,
    )[0]

    row = {
        "space_type": space_type,
        "area_sqm": area_sqm,
        "length_m": length_m,
        "width_m": width_m,
        "sunlight_hours": sunlight_hours,
        "shade_level": _shade_from_sun(sunlight_hours, rng),
        "wind_exposure": wind_exposure,
        "water_access": water_access,
        "drainage_quality": drainage_quality,
        "avg_day_temp_c": avg_day_temp_c,
        "peak_surface_temp_c": peak_surface_temp_c,
        "humidity_pct": humidity_pct,
        "rainfall_level": rainfall_level,
        "heat_island_score": heat_island_score,
        "maintenance_level": maintenance_level,
        "budget_level": budget_level,
        "preferred_style": preferred_style,
        "edible_preference": edible_preference,
        "flowering_preference": flowering_preference,
        "pet_safe_required": pet_safe_required,
        "irrigation_allowed": irrigation_allowed,
    }
    row["_water_stress"] = _water_stress_index(
        water_access, irrigation_allowed, rainfall_level
    )
    return row


def species_logit(row: dict, sp: dict) -> float:
    """
    Rule-based compatibility score (logit-scale, before sigmoid).
    Higher => more likely positive label.
    """
    z = 0.15  # mild prior toward some positives

    sun = float(row["sunlight_hours"])
    min_sun = sp["min_sun"]
    max_sun = sp["max_sun"]
    if sun < min_sun:
        z -= 0.55 * (min_sun - sun)
    if sun > max_sun:
        z -= 0.45 * (sun - max_sun)

    heat = float(row["avg_day_temp_c"])
    heat_stress = max(0.0, heat - 30.0)
    if heat_stress > 0:
        if sp["heat_tolerant"]:
            z += 0.12 * heat_stress
        else:
            z -= 0.14 * heat_stress

    ws = float(row["_water_stress"])
    if ws > 0.35:
        if sp["drought_tolerant"]:
            z += 1.15 * ws
        else:
            z -= 0.95 * ws

    if row["edible_preference"] == 1:
        if sp["edible"]:
            z += 1.35
        else:
            z -= 0.45

    if row["flowering_preference"] == 1:
        if sp["flowering"]:
            z += 0.95
        else:
            z -= 0.35

    if row["pet_safe_required"] == 1 and not sp["pet_safe"]:
        z -= 6.0

    if row["maintenance_level"] <= 1 and sp["low_maintenance"]:
        z += 0.55
    if row["maintenance_level"] >= 2 and not sp["low_maintenance"]:
        z -= 0.35

    # Humidity + drainage: fussy edibles suffer in poor drainage + high humidity
    if row["drainage_quality"] == "POOR" and not sp["drought_tolerant"]:
        z -= 0.25
    if row["humidity_pct"] > 75 and not sp["heat_tolerant"]:
        z -= 0.15

    # Style nudges (soft)
    st = row["preferred_style"]
    if st == "food_garden" and sp["edible"]:
        z += 0.45
    if st == "ornamental_color" and sp["flowering"]:
        z += 0.4
    if st == "minimal_low_care" and sp["low_maintenance"]:
        z += 0.5
    if st == "cooling_green" and sp["code"] in (
        "pothos",
        "snake_plant",
        "spider_plant",
        "malabar_spinach",
        "bougainvillea",
    ):
        z += 0.25

    if row["budget_level"] <= 1 and sp["code"] in (
        "marigold",
        "portulaca",
        "zinnia",
        "coriander",
        "chilli",
    ):
        z += 0.25

    return z


def sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def sample_labels_for_row(row: dict, rng: random.Random, min_labels: int = 1, max_labels: int = 6) -> dict[str, int]:
    """
    Independent Bernoulli per species with p = sigmoid(logit - threshold).
    Enforce at least min_labels if all-zero (stabilize training).
    """
    probs: list[tuple[str, float]] = []
    for sp in SPECIES_TRAITS:
        logit = species_logit(row, sp)
        p = sigmoid(logit - 0.85)
        p = min(0.82, max(0.02, p))
        probs.append((sp["code"], p))

    labels = {code: 1 if rng.random() < p else 0 for code, p in probs}

    if sum(labels.values()) < min_labels:
        ranked = sorted(probs, key=lambda t: t[1], reverse=True)
        for code, _ in ranked[:min_labels]:
            labels[code] = 1

    # Cap overly dense labels (keep multi-label but not all-ones)
    while sum(labels.values()) > max_labels:
        positives = [c for c, v in labels.items() if v == 1]
        drop = rng.choice(positives)
        if len(positives) <= min_labels:
            break
        labels[drop] = 0

    return labels


@dataclass
class Meta:
    kind: str
    generator: str
    created_at_utc: str
    n_rows: int
    n_species: int
    feature_columns: list[str]
    species_codes: list[str]
    notes: str


def parse_args() -> argparse.Namespace:
    root = _repo_ml_root()
    p = argparse.ArgumentParser(description="Generate synthetic bootstrap species training CSV.")
    p.add_argument("--n-rows", type=int, default=4000, help="Number of synthetic rows")
    p.add_argument("--seed", type=int, default=42, help="RNG seed")
    p.add_argument(
        "--output",
        type=Path,
        default=root / "data" / "bootstrap_species_training.csv",
        help="Output CSV path",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()
    rng = random.Random(args.seed)
    species_codes = sorted(sp["code"] for sp in SPECIES_TRAITS)

    column_order = FEATURE_COLUMNS + ["data_source"] + [f"species_{c}" for c in species_codes]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=column_order, lineterminator="\n")
        w.writeheader()
        for _ in range(args.n_rows):
            feats = sample_feature_row(rng)
            labels = sample_labels_for_row(feats, rng)
            out = {k: feats[k] for k in FEATURE_COLUMNS}
            out["data_source"] = "synthetic_bootstrap_v1"
            for code in species_codes:
                out[f"species_{code}"] = labels[code]
            w.writerow(out)

    meta_path = args.output.with_suffix(".meta.json")
    meta = Meta(
        kind="synthetic_bootstrap",
        generator="ml-models/scripts/generate_bootstrap_species_dataset.py",
        created_at_utc=datetime.now(timezone.utc).isoformat(),
        n_rows=args.n_rows,
        n_species=len(species_codes),
        feature_columns=list(FEATURE_COLUMNS),
        species_codes=species_codes,
        notes=(
            "Not real user data. Rule-based labels from SPECIES_TRAITS. "
            "Exclude column data_source when training or concatenate with real exports "
            "only after aligning species columns and tagging source."
        ),
    )
    meta_path.write_text(json.dumps(asdict(meta), indent=2), encoding="utf-8")

    print(f"Wrote {args.output} ({args.n_rows} rows)")
    print(f"Wrote {meta_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

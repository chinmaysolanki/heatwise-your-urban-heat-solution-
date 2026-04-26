"""
species_ml_scorer.py
====================
Loads the three trained species recommender models from the registry and exposes
`score_species_batch()` for use inside the serving orchestrator.

Also provides a standalone CLI entry-point used by the Next.js API layer:
  python -m serving.scoring.species_ml_scorer --registry-dir <path> < request.json

The CLI reads a JSON request from stdin and writes JSON scores to stdout.

Models loaded:
  species_scorer  — relevance regression (float 0–1)
  heat_scorer     — heat-mitigation regression (float 0–1)
  species_ranker  — pairwise preference classifier (prob 0–1)
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np

# ── optional joblib import (fail gracefully for unit tests without it) ──
try:
    import joblib
    _JOBLIB_OK = True
except ImportError:
    _JOBLIB_OK = False


# ─────────────────────────────────────────────────────────────────────────────
# Feature encoding helpers  (mirrors train_species_recommender.py)
# ─────────────────────────────────────────────────────────────────────────────

CLIMATE_ORDER = ["HOT_HUMID", "HOT_DRY", "MONSOON_HEAVY", "TEMPERATE_LITE"]
WATER_MAP   = {"LOW": 0, "MED": 1, "HIGH": 2}
SUN_MAP     = {"SHADE": 0, "PART": 1, "FULL": 2}
MAINT_MAP   = {"LOW": 0, "MED": 1, "HIGH": 2}
ROOT_MAP    = {"LOW": 0, "MED": 1, "HIGH": 2}
SAFETY_MAP  = {"SAFE": 2, "CAUTION": 1, "UNSAFE": 0}
NATIVE_MAP  = {"LOW": 0, "MED": 1, "HIGH": 2}
CONT_MAP    = {"EXCELLENT": 3, "GOOD": 2, "FAIR": 1, "POOR": 0}

HABITS = ["HERB","SHRUB","UPRIGHT","VINE","GROUND_COVER","TRAILING","SUCCULENT","GRASS"]

SUN_SC  = {"shade": 0, "partial": 1, "full": 2}
WATER_SC= {"scarce": 0, "moderate": 1, "plentiful": 2}
WIND_SC = {"low": 0, "medium": 1, "high": 2}
HEAT_SC = {"low": 0, "moderate": 1, "high": 2, "extreme": 3}
MAINT_SC= {"minimal": 0, "low": 0, "moderate": 1, "high": 2}
PURPS   = ["cooling","food","aesthetic","privacy","biodiversity","mixed"]
SPACES  = ["outdoor_rooftop","outdoor_balcony","outdoor_terrace","indoor"]


def _encode_species(sp: dict) -> dict:
    """Encode a species dict to the 23 feature vector used during training."""
    climates = str(sp.get("climate_suitability", ""))
    feats: dict[str, float] = {}

    for c in CLIMATE_ORDER:
        feats[f"climate_{c.lower()}"] = float(c in climates)

    feats["sunlight_pref_ord"]         = float(SUN_MAP.get(str(sp.get("sunlight_preference","PART")), 1))
    feats["water_demand_ord"]          = float(WATER_MAP.get(str(sp.get("water_demand","MED")), 1))
    feats["maintenance_ord"]           = float(MAINT_MAP.get(str(sp.get("maintenance_need","MED")), 1))
    feats["root_aggressiveness_ord"]   = float(ROOT_MAP.get(str(sp.get("root_aggressiveness","MED")), 1))
    feats["child_pet_safety_ord"]      = float(SAFETY_MAP.get(str(sp.get("child_pet_safety","CAUTION")), 1))
    feats["native_support_ord"]        = float(NATIVE_MAP.get(str(sp.get("native_support","MED")), 1))
    feats["container_suitability_ord"] = float(CONT_MAP.get(str(sp.get("container_suitability","GOOD")), 2))
    feats["pollinator_value"]          = float(sp.get("pollinator_value", 0) or 0)
    feats["cooling_contribution"]      = float(sp.get("cooling_contribution", 0) or 0)
    feats["privacy_contribution"]      = float(sp.get("privacy_contribution", 0) or 0)
    feats["edible"]                    = float(sp.get("edible", 0) or 0)

    habit = str(sp.get("growth_habit", "HERB"))
    for h in HABITS:
        feats[f"habit_{h.lower()}"] = float(habit == h)

    return feats


def _encode_scenario(sc: dict) -> dict:
    """Encode a scenario dict to the 20 scenario feature vector."""
    purp  = str(sc.get("purpose_primary", "mixed"))
    space = str(sc.get("space_type", "outdoor_rooftop"))
    feats: dict[str, float] = {
        "sun_ord":          float(SUN_SC.get(str(sc.get("sun", "full")), 2)),
        "water_avail_ord":  float(WATER_SC.get(str(sc.get("water_availability","moderate")), 1)),
        "wind_ord":         float(WIND_SC.get(str(sc.get("wind_level","low")), 0)),
        "heat_ord":         float(HEAT_SC.get(str(sc.get("heat_exposure","moderate")), 1)),
        "maint_pref_ord":   float(MAINT_SC.get(str(sc.get("maintenance_preference","moderate")), 1)),
        "pet_safe_required":float(bool(sc.get("pet_safe_required", 0))),
        "edible_preferred": float(bool(sc.get("edible_preferred", 0))),
        "floor_level_norm": min(1.0, float(sc.get("floor_level", 1)) / 25.0),
        "area_m2_norm":     min(1.0, float(sc.get("area_m2", 24)) / 80.0),
    }
    for p in PURPS:
        feats[f"purpose_{p}"] = float(purp == p)
    for s in SPACES:
        key = s.replace("outdoor_", "space_")
        if key.startswith("space_"):
            pass
        key = "space_" + s.split("_")[-1]
        feats[key] = float(space == s)
    return feats


def _build_reg_row(sp: dict, sc: dict) -> dict:
    """Build the flat feature row for scorer / heat_scorer (scenario + species)."""
    row = {}
    row.update(_encode_scenario(sc))
    row.update(_encode_species(sp))
    return row


def _build_pair_row(sp_a: dict, sp_b: dict, sc: dict) -> dict:
    """Build the flat feature row for the ranker (scenario + spA + spB + diff)."""
    sc_feat = _encode_scenario(sc)
    fa = _encode_species(sp_a)
    fb = _encode_species(sp_b)
    row: dict[str, float] = {}
    for k, v in sc_feat.items():
        row[f"sc_{k}"] = v
    for col in sorted(fa):
        row[f"a_{col}"] = fa[col]
        row[f"b_{col}"] = fb.get(col, 0.0)
        row[f"d_{col}"] = fa[col] - fb.get(col, 0.0)
    row["score_diff"] = 0.0  # unknown at inference time; placeholder
    return row


# ─────────────────────────────────────────────────────────────────────────────
# Model loader
# ─────────────────────────────────────────────────────────────────────────────

class SpeciesMLScorer:
    """Loads trained models from registry/artifacts and exposes scoring methods."""

    def __init__(self, registry_dir: str | Path | None = None):
        self._scorer   = None
        self._heat     = None
        self._ranker   = None
        self._scorer_cols: list[str] = []
        self._heat_cols:   list[str] = []
        self._ranker_cols: list[str] = []
        self._loaded = False

        if registry_dir is None:
            registry_dir = os.environ.get("HEATWISE_REGISTRY_DIR") or (
                Path(__file__).resolve().parents[2] / "registry"
            )
        self._registry_dir = Path(registry_dir)
        self._artifacts_dir = self._registry_dir / "artifacts"

    def load(self) -> bool:
        """Load all three models. Returns True on full success."""
        if not _JOBLIB_OK:
            return False
        ok = True
        for name, attr_m, attr_c in [
            ("species_scorer", "_scorer",  "_scorer_cols"),
            ("heat_scorer",    "_heat",    "_heat_cols"),
            ("species_ranker", "_ranker",  "_ranker_cols"),
        ]:
            path = self._artifacts_dir / name / "model.joblib"
            if not path.exists():
                print(f"[species_ml_scorer] model not found: {path}", file=sys.stderr)
                ok = False
                continue
            bundle = joblib.load(path)
            setattr(self, attr_m, bundle["model"])
            setattr(self, attr_c, bundle["feature_cols"])
        self._loaded = ok
        return ok

    def _align(self, row: dict, cols: list[str]) -> np.ndarray:
        """Convert row dict to numpy array aligned to trained feature order."""
        import pandas as pd
        df = pd.DataFrame([row])
        for c in cols:
            if c not in df.columns:
                df[c] = 0.0
        return df[cols].values.astype(np.float32)

    def score_species(
        self,
        species: dict,
        scenario: dict,
    ) -> dict[str, float | None]:
        """
        Score a single species against a scenario.

        Returns:
          relevance_score: float [0,1]  — overall fit for scenario
          heat_score:      float [0,1]  — cooling/heat mitigation contribution
        """
        if not self._loaded:
            return {"relevance_score": None, "heat_score": None}

        row = _build_reg_row(species, scenario)

        rel_score: float | None = None
        if self._scorer is not None:
            try:
                X = self._align(row, self._scorer_cols)
                rel_score = float(np.clip(self._scorer.predict(X)[0], 0.0, 1.0))
            except Exception as e:  # noqa: BLE001
                print(f"[species_ml_scorer] scorer error: {e}", file=sys.stderr)

        heat_score: float | None = None
        if self._heat is not None:
            try:
                X = self._align(row, self._heat_cols)
                heat_score = float(np.clip(self._heat.predict(X)[0], 0.0, 1.0))
            except Exception as e:  # noqa: BLE001
                print(f"[species_ml_scorer] heat scorer error: {e}", file=sys.stderr)

        return {"relevance_score": rel_score, "heat_score": heat_score}

    def score_species_batch(
        self,
        species_list: list[dict],
        scenario: dict,
    ) -> list[dict[str, float | None]]:
        """Score a list of species against one scenario. Fast batch inference."""
        if not self._loaded or not species_list:
            return [{"relevance_score": None, "heat_score": None}] * len(species_list)

        rows = [_build_reg_row(sp, scenario) for sp in species_list]

        import pandas as pd
        df = pd.DataFrame(rows)

        results: list[dict] = []
        scores: np.ndarray | None = None
        heats:  np.ndarray | None = None

        if self._scorer is not None and self._scorer_cols:
            try:
                Xdf = df.reindex(columns=self._scorer_cols, fill_value=0.0)
                scores = np.clip(self._scorer.predict(Xdf.values.astype(np.float32)), 0.0, 1.0)
            except Exception as e:  # noqa: BLE001
                print(f"[species_ml_scorer] batch scorer error: {e}", file=sys.stderr)

        if self._heat is not None and self._heat_cols:
            try:
                Xdf = df.reindex(columns=self._heat_cols, fill_value=0.0)
                heats = np.clip(self._heat.predict(Xdf.values.astype(np.float32)), 0.0, 1.0)
            except Exception as e:  # noqa: BLE001
                print(f"[species_ml_scorer] batch heat error: {e}", file=sys.stderr)

        for i in range(len(species_list)):
            results.append({
                "relevance_score": float(scores[i]) if scores is not None else None,
                "heat_score":      float(heats[i])  if heats  is not None else None,
            })
        return results

    def rank_pair(
        self,
        sp_a: dict,
        sp_b: dict,
        scenario: dict,
    ) -> float | None:
        """
        Returns probability that sp_a is preferred over sp_b for the given scenario.
        0.5 = uncertain, >0.5 = prefer A, <0.5 = prefer B.
        """
        if not self._loaded or self._ranker is None:
            return None
        try:
            row = _build_pair_row(sp_a, sp_b, scenario)
            X   = self._align(row, self._ranker_cols)
            prob = float(self._ranker.predict_proba(X)[0][1])
            return prob
        except Exception as e:  # noqa: BLE001
            print(f"[species_ml_scorer] ranker error: {e}", file=sys.stderr)
            return None


# ─────────────────────────────────────────────────────────────────────────────
# CLI entry point — called by Node.js pages/api layer via child_process
# ─────────────────────────────────────────────────────────────────────────────

def _cli():
    """
    stdin:  JSON { species: [...], scenario: {...}, registry_dir?: "..." }
    stdout: JSON { scored: [{ species_key, relevance_score, heat_score }, ...] }
    """
    try:
        payload = json.loads(sys.stdin.read())
    except Exception as e:
        json.dump({"error": f"invalid JSON input: {e}"}, sys.stdout)
        sys.exit(1)

    registry_dir = payload.get("registry_dir") or os.environ.get("HEATWISE_REGISTRY_DIR")
    scorer = SpeciesMLScorer(registry_dir)
    if not scorer.load():
        json.dump({"error": "model load failed — run train_species_recommender.py first"}, sys.stdout)
        sys.exit(1)

    species_list = payload.get("species", [])
    scenario     = payload.get("scenario", {})

    scores = scorer.score_species_batch(species_list, scenario)

    result = []
    for sp, sc in zip(species_list, scores):
        result.append({
            "species_key":     sp.get("species_key") or sp.get("code") or sp.get("name", ""),
            "relevance_score": sc["relevance_score"],
            "heat_score":      sc["heat_score"],
        })

    json.dump({"scored": result}, sys.stdout)


if __name__ == "__main__":
    _cli()

#!/usr/bin/env python3
"""
Emit geospatial_features.csv, geo_targets_alignment.csv, geospatial_joined_training_table.csv.

Reads JSONL: each line optional keys geo_context, microclimate_snapshot, site_exposure,
project_id, targets (dict of alignment labels).
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT.parent.parent) not in sys.path:
    sys.path.insert(0, str(_ROOT.parent.parent))

from ml.geospatial_intelligence.mappers.geo_feature_mapper import map_geo_context_to_features
from ml.geospatial_intelligence.mappers.microclimate_feature_mapper import map_microclimate_to_features
from ml.geospatial_intelligence.mappers.site_context_mapper import map_site_exposure_to_features

from ._csv_util import write_csv


def _load_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        out.append(json.loads(line))
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path, required=True, help="JSONL with enrichment records")
    ap.add_argument("--out-dir", type=Path, required=True)
    args = ap.parse_args()
    raw = _load_rows(args.input)

    geo_rows: list[dict] = []
    joined: list[dict] = []
    targets: list[dict] = []

    for i, rec in enumerate(raw):
        pid = str(rec.get("project_id") or f"proj_{i}")
        gc = rec.get("geo_context") or {}
        mc = rec.get("microclimate_snapshot") or {}
        se = rec.get("site_exposure") or {}
        g = map_geo_context_to_features(gc, project_id=pid)
        m = map_microclimate_to_features(mc)
        s = map_site_exposure_to_features(se)
        geo_rows.append({**g, **{k: v for k, v in m.items() if k != "project_id"}, **s})

        row = {**g, **m, **s, "join_project_id": pid}
        tg = rec.get("targets") or {}
        default_align = {
            "heat_mitigation_outcome_proxy": float(se.get("cooling_need_score") or 0) * 0.9,
            "maintenance_fit_proxy": 1.0 - float(se.get("maintenance_stress_score") or 0),
            "survival_risk_proxy": float(se.get("irrigation_need_risk_score") or 0),
            "install_complexity_proxy": float(se.get("overall_site_complexity_score") or 0),
            "ranking_success_proxy": float(mc.get("source_confidence") or gc.get("source_confidence") or 0.5),
        }
        merged_t = {**default_align, **{str(k): v for k, v in tg.items()}}
        targets.append({"project_id": pid, **merged_t})
        joined.append({**row, **{f"target_{k}": v for k, v in merged_t.items()}})

    write_csv(args.out_dir / "geospatial_features.csv", geo_rows)
    write_csv(args.out_dir / "geo_targets_alignment.csv", targets)
    write_csv(args.out_dir / "geospatial_joined_training_table.csv", joined)
    print(f"Wrote {len(joined)} rows to {args.out_dir}", file=sys.stderr)


if __name__ == "__main__":
    main()

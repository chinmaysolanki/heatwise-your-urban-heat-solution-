#!/usr/bin/env python3
"""
Validate that Python serving can resolve HEATWISE_REGISTRY_DIR and load production bundles.

Usage (from heatwise/ml):
  HEATWISE_REGISTRY_DIR=/path/to/registry python3 scripts/validate_serving_bundles.py

`load_production_bundles` reads ``registry_index.json`` and loads latest **production** rows per
task (feasibility, heat_score, ranking). Missing index or missing artifacts is OK for local dev;
the script exits 0 after printing what loaded. Set ``--strict`` to exit 1 if the index exists
and no bundle could be loaded for any task.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

_ML = Path(__file__).resolve().parents[1]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from serving.loaders.load_inference_bundle import (
    diagnose_production_bundle_loading,
    load_production_bundles,
    resolve_registry_dir,
)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 if registry_index.json exists but no production bundle loads",
    )
    args = p.parse_args()
    reg = os.environ.get("HEATWISE_REGISTRY_DIR", "").strip()
    if not reg:
        print("Set HEATWISE_REGISTRY_DIR to a registry root (see docs/ML_REGISTRY_AND_SERVING.md).", file=sys.stderr)
        return 1
    root = resolve_registry_dir(reg)
    report = diagnose_production_bundle_loading(root)
    bundles = load_production_bundles(root)
    loaded = {k: v is not None for k, v in bundles.items()}
    print(json.dumps({"diagnostics": report, "bundles_loaded": loaded}, indent=2))
    if args.strict and report.get("has_registry_index") and not any(loaded.values()):
        print("Strict mode: index present but no bundles loaded.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

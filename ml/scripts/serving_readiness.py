#!/usr/bin/env python3
"""Print JSON readiness for HEATWISE_REGISTRY_DIR (preflight for Node → Python serving)."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

_ML = Path(__file__).resolve().parents[1]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from serving.loaders.load_inference_bundle import diagnose_production_bundle_loading, resolve_registry_dir


def main() -> int:
    p = argparse.ArgumentParser(description="HeatWise ML serving registry / bundle readiness")
    p.add_argument(
        "--strict",
        action="store_true",
        help="Exit 1 if readiness is not 'full' (requires registry index and all tasks loaded)",
    )
    args = p.parse_args()
    reg = os.environ.get("HEATWISE_REGISTRY_DIR", "").strip()
    if not reg:
        print(
            json.dumps(
                {
                    "readiness": "unset",
                    "failure_modes": ["HEATWISE_REGISTRY_DIR not set — ML ranker may run rules-only."],
                },
                indent=2,
            )
        )
        return 2 if args.strict else 0
    try:
        root = resolve_registry_dir(reg)
    except ValueError as e:
        print(json.dumps({"readiness": "error", "failure_modes": [str(e)]}, indent=2))
        return 2 if args.strict else 1
    report = diagnose_production_bundle_loading(root)
    print(json.dumps(report, indent=2))
    if args.strict and report.get("readiness") != "full":
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

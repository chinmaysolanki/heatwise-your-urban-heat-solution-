"""Stdin JSON → stdout JSON (see ``serving_response_contract`` for success criteria)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Ensure ``ml`` is on path when run as ``python -m serving`` from ``heatwise/ml``
_ML = Path(__file__).resolve().parents[1]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

from serving.orchestration.recommendation_orchestrator import run_recommendation_request
from serving.serving_response_contract import stdout_payload_is_usable


def main() -> int:
    try:
        req = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"serving_stdin_json_error:{e}", file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001
        print(f"serving_stdin_load_error:{e}", file=sys.stderr)
        return 1

    try:
        out = run_recommendation_request(req)
    except Exception as e:  # noqa: BLE001
        print(f"serving_orchestrator_exception:{e}", file=sys.stderr)
        return 1

    ok, reason = stdout_payload_is_usable(out)
    if not ok:
        print(f"serving_unusable:{reason}", file=sys.stderr)
        return 1

    out["heatwiseServingOk"] = True
    json.dump(out, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

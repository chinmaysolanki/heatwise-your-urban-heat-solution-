#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# Minimal deps for bundle smoke (joblib-only stub models).
.venv/bin/pip install -q pytest joblib
exec .venv/bin/python -m pytest serving/tests/test_bundle_registry_smoke.py -q

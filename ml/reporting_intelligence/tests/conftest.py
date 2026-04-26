"""Ensure `import reporting_intelligence` works when pytest cwd is this package."""

from __future__ import annotations

import sys
from pathlib import Path

_ml_root = Path(__file__).resolve().parents[2]
if str(_ml_root) not in sys.path:
    sys.path.insert(0, str(_ml_root))

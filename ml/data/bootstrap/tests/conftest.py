"""Pytest path: bootstrap root on ``sys.path`` for ``synthetic_bootstrap`` and top-level packages."""

from __future__ import annotations

import sys
from pathlib import Path

_BOOTSTRAP_ROOT = Path(__file__).resolve().parent.parent
if str(_BOOTSTRAP_ROOT) not in sys.path:
    sys.path.insert(0, str(_BOOTSTRAP_ROOT))

BOOTSTRAP_ROOT = _BOOTSTRAP_ROOT

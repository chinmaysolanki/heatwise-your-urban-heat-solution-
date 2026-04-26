"""Put ``heatwise/ml`` on path for ``evaluation`` package imports."""

from __future__ import annotations

import sys
from pathlib import Path

_ML_ROOT = Path(__file__).resolve().parents[2]
if str(_ML_ROOT) not in sys.path:
    sys.path.insert(0, str(_ML_ROOT))

from __future__ import annotations

import sys
from pathlib import Path

_ML = Path(__file__).resolve().parents[2]
if str(_ML) not in sys.path:
    sys.path.insert(0, str(_ML))

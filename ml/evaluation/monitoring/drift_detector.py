"""
Lightweight distribution drift helpers (histogram / PSI-style on binned scores).
"""

from __future__ import annotations

import math
from typing import Sequence


def psi(expected_hist: Sequence[float], actual_hist: Sequence[float], *, eps: float = 1e-6) -> float:
    """
    Population Stability Index on aligned probability vectors (sum ~1 each).
    """
    e = [max(float(x), eps) for x in expected_hist]
    a = [max(float(x), eps) for x in actual_hist]
    se = sum(e)
    sa = sum(a)
    e = [x / se for x in e]
    a = [x / sa for x in a]
    out = 0.0
    for pi, qi in zip(e, a):
        out += (qi - pi) * math.log(qi / pi)
    return float(out)


def simplified_bin_counts(scores: Sequence[float], n_bins: int = 10) -> list[float]:
    if not scores:
        return [0.0] * n_bins
    lo, hi = min(scores), max(scores)
    if hi <= lo:
        out = [0.0] * n_bins
        out[0] = float(len(scores))
        return out
    width = (hi - lo) / n_bins
    counts = [0.0] * n_bins
    for s in scores:
        idx = int((s - lo) / width)
        if idx >= n_bins:
            idx = n_bins - 1
        elif idx < 0:
            idx = 0
        counts[idx] += 1.0
    return counts


def score_distribution_psi(baseline_scores: Sequence[float], current_scores: Sequence[float], n_bins: int = 10) -> float:
    e = simplified_bin_counts(baseline_scores, n_bins)
    a = simplified_bin_counts(current_scores, n_bins)
    return psi(e, a)

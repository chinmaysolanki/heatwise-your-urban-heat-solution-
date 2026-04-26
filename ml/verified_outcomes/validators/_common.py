from __future__ import annotations

import json
from typing import Any

from verified_outcomes.mismatch_reasons import MISMATCH_REASON_CODES


def parse_json_list(s: str | None) -> list[Any]:
    if not s:
        return []
    try:
        v = json.loads(s)
        return v if isinstance(v, list) else []
    except json.JSONDecodeError:
        return []


def validate_mismatch_codes(codes: list[str]) -> tuple[bool, str]:
    if not isinstance(codes, list):
        return False, "mismatch_reason_codes_json must be a list"
    for c in codes:
        if not isinstance(c, str) or c not in MISMATCH_REASON_CODES:
            return False, f"invalid_mismatch_code:{c}"
    return True, ""


def validate_match_vs_mismatch(
    matches: bool,
    codes: list[str],
    *,
    allow_warning_notes: bool = False,
) -> tuple[bool, str]:
    """
    Rule: ``matches_recommended_candidate=True`` should not coexist with non-empty mismatch codes
    unless ``allow_warning_notes`` (documented exception for minor deltas still flagged).
    """
    if matches and codes and not allow_warning_notes:
        return False, "matches_true_with_mismatch_codes"
    if not matches and not codes:
        return False, "matches_false_requires_mismatch_codes"
    return True, ""

"""
Contract for ``python -m serving`` stdout JSON consumed by Node.

**Usable** means the app can rank and show at least one non-blocked candidate.
Failures must not use exit code 0 with an empty or blocked-only slate.
"""

from __future__ import annotations

from typing import Any


ALLOWED_MODES = frozenset({"full_ml", "rules_only", "partial_ml"})


def stdout_payload_is_usable(body: Any) -> tuple[bool, str]:
    """
    Return (True, "") if ``body`` is a usable recommendation response; else (False, reason_code).

    reason_code is stable for Node diagnostics (prefix ``unusable_``).
    """
    if not isinstance(body, dict):
        return False, "unusable_not_object"
    if body.get("heatwiseServingOk") is False:
        return False, "unusable_heatwise_serving_ok_false"
    mode = body.get("mode")
    if mode not in ALLOWED_MODES:
        return False, "unusable_invalid_mode"
    tm = body.get("telemetryMeta")
    if not isinstance(tm, dict):
        return False, "unusable_missing_telemetry_meta"
    cands = body.get("candidates")
    if not isinstance(cands, list):
        return False, "unusable_candidates_not_list"
    if len(cands) == 0:
        return False, "unusable_empty_candidates"
    if not any(isinstance(c, dict) and not c.get("blocked") for c in cands):
        return False, "unusable_all_candidates_blocked"
    return True, ""

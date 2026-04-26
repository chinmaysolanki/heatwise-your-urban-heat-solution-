from __future__ import annotations

import json
from typing import Any

from verified_outcomes.validators._common import validate_match_vs_mismatch, validate_mismatch_codes


def validate_verified_install(row: dict[str, Any]) -> tuple[bool, list[str]]:
    errs: list[str] = []
    area = row.get("installed_area_sqft") or row.get("installedAreaSqft")
    if not isinstance(area, (int, float)) or area <= 0 or area > 1_000_000:
        errs.append("installed_area_plausible")

    conf = row.get("installer_confidence_score") or row.get("installerConfidenceScore")
    if not isinstance(conf, (int, float)) or conf < 0 or conf > 1:
        errs.append("installer_confidence_0_1")

    raw_codes = row.get("mismatch_reason_codes_json") or row.get("mismatchReasonCodesJson")
    if isinstance(raw_codes, str):
        try:
            codes = json.loads(raw_codes)
        except json.JSONDecodeError:
            errs.append("mismatch_codes_invalid_json")
            codes = []
    else:
        codes = list(raw_codes or [])

    ok_c, msg = validate_mismatch_codes(codes)
    if not ok_c:
        errs.append(msg)

    matches = bool(row.get("matches_recommended_candidate") or row.get("matchesRecommendedCandidate"))
    ok_m, msg_m = validate_match_vs_mismatch(matches, codes, allow_warning_notes=False)
    if not ok_m:
        errs.append(msg_m)

    return len(errs) == 0, errs

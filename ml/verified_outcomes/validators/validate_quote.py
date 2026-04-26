from __future__ import annotations

from typing import Any


def validate_installer_quote(row: dict[str, Any]) -> tuple[bool, list[str]]:
    errs: list[str] = []
    amt = row.get("quote_amount_inr") or row.get("quoteAmountInr")
    if not isinstance(amt, (int, float)) or amt <= 0:
        errs.append("quote_amount_inr_must_be_positive")
    days = row.get("estimated_timeline_days") or row.get("estimatedTimelineDays")
    if not isinstance(days, int) or days < 1 or days > 730:
        errs.append("estimated_timeline_days_sanity")
    return len(errs) == 0, errs

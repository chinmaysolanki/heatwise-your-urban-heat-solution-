from __future__ import annotations

from typing import Any


def map_insight_to_row(ins: dict[str, Any]) -> dict[str, Any]:
    return {k: ins.get(k) for k in ins.keys()}


def map_variant_to_row(v: dict[str, Any]) -> dict[str, Any]:
    return {k: v.get(k) for k in v.keys()}

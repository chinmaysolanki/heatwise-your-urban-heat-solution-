"""Experiment-style metrics from session export rows (generatorSource × rulesVersion)."""

from __future__ import annotations

from typing import Any


def _median(nums: list[int]) -> float | None:
    if not nums:
        return None
    s = sorted(nums)
    m = len(s) // 2
    return float(s[m]) if len(s) % 2 else (s[m - 1] + s[m]) / 2.0


def aggregate_experiment_metrics(
    sessions: list[dict[str, Any]],
    events_by_session: dict[str, dict[str, int]],
) -> dict[str, Any]:
    """
    ``sessions``: id, generatorSource, rulesVersion, latencyMs
    ``events_by_session``: session_id -> { eventType: count }
    """
    by_variant: dict[str, dict[str, Any]] = {}

    for s in sessions:
        gs = str(s.get("generatorSource") or "unknown")
        rv = str(s.get("rulesVersion") or "unknown")
        key = f"{gs}::{rv}"
        if key not in by_variant:
            by_variant[key] = {
                "variant_key": key,
                "session_count": 0,
                "generator_source_mix": {},
                "rules_version_mix": {},
                "latencies": [],
                "impression_count": 0,
                "select_count": 0,
                "installer_request_count": 0,
            }
        v = by_variant[key]
        v["session_count"] += 1
        v["generator_source_mix"][gs] = v["generator_source_mix"].get(gs, 0) + 1
        v["rules_version_mix"][rv] = v["rules_version_mix"].get(rv, 0) + 1
        lat = s.get("latencyMs")
        if isinstance(lat, (int, float)):
            v["latencies"].append(int(lat))

        evs = events_by_session.get(str(s.get("id")), {})
        v["impression_count"] += int(
            evs.get("recommendation_impression", 0)
            + evs.get("recommendation_view", 0)
            + evs.get("candidate_viewed", 0)
        )
        v["select_count"] += int(evs.get("recommendation_select", 0) + evs.get("candidate_selected", 0))
        v["installer_request_count"] += int(evs.get("recommendation_request_installer", 0))

    out = []
    for v in by_variant.values():
        latencies = v.pop("latencies")
        v["median_latency_ms"] = _median(latencies)
        out.append(v)

    out.sort(key=lambda x: -x["session_count"])
    return {"by_variant": out}

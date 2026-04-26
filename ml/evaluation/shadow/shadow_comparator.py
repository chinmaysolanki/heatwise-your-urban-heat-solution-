"""
Compare primary vs shadow recommendation payloads (candidate lists, scores, safety).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Sequence


def _candidate_ids(candidates: Sequence[dict[str, Any]]) -> list[str]:
    out: list[str] = []
    for c in candidates:
        cid = c.get("candidateId") or c.get("candidate_id") or c.get("species_id") or c.get("id")
        if cid is not None:
            out.append(str(cid))
    return out


def _scores(candidates: Sequence[dict[str, Any]]) -> list[float]:
    s: list[float] = []
    for c in candidates:
        scores = c.get("scores")
        if isinstance(scores, dict):
            v = scores.get("blended")
        else:
            v = c.get("score") or c.get("total_score")
        try:
            s.append(float(v) if v is not None else 0.0)
        except (TypeError, ValueError):
            s.append(0.0)
    return s


def _get_num(c: dict[str, Any], *keys: str) -> float | None:
    payload = c.get("candidatePayload") if isinstance(c.get("candidatePayload"), dict) else c
    for k in keys:
        v = payload.get(k) if isinstance(payload, dict) else None
        if v is None:
            v = c.get(k)
        if v is None:
            continue
        try:
            return float(v)
        except (TypeError, ValueError):
            continue
    return None


def top_k_overlap(ids_a: list[str], ids_b: list[str], k: int) -> int:
    sa = set(ids_a[:k])
    sb = set(ids_b[:k])
    return len(sa & sb)


def rank_displacement(ids_primary: list[str], ids_shadow: list[str]) -> list[dict[str, Any]]:
    """For each id in primary order, rank in shadow (missing = -1)."""
    rank_b = {cid: i for i, cid in enumerate(ids_shadow)}
    out: list[dict[str, Any]] = []
    for i, cid in enumerate(ids_primary):
        j = rank_b.get(cid, -1)
        out.append({"candidate_id": cid, "primary_rank": i, "shadow_rank": j, "delta": (j - i) if j >= 0 else None})
    return out


def average_rank_shift(displacements: list[dict[str, Any]], *, top_n: int = 10) -> float:
    deltas = [d["delta"] for d in displacements[:top_n] if d.get("delta") is not None]
    if not deltas:
        return 0.0
    return sum(abs(x) for x in deltas) / len(deltas)


@dataclass
class ShadowComparison:
    exact_top1_match: bool
    top3_overlap_count: int
    top_k_overlap: dict[int, int] = field(default_factory=dict)
    average_rank_shift: float = 0.0
    score_delta_top1: float | None = None
    ordering_divergence_count: int = 0
    filtered_candidate_count_delta: int = 0
    expected_temp_reduction_delta: float | None = None
    expected_install_cost_delta: float | None = None
    feasibility_delta: float | None = None
    safety_delta: float | None = None
    explanation_diff_chars: int | None = None
    primary_top_id: str | None = None
    shadow_top_id: str | None = None
    rules_version_match: bool = True
    model_version_notes: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "exact_top1_match": self.exact_top1_match,
            "top3_overlap_count": self.top3_overlap_count,
            "top_k_overlap": self.top_k_overlap,
            "average_rank_shift": self.average_rank_shift,
            "score_delta_top1": self.score_delta_top1,
            "ordering_divergence_count": self.ordering_divergence_count,
            "filtered_candidate_count_delta": self.filtered_candidate_count_delta,
            "expected_temp_reduction_delta": self.expected_temp_reduction_delta,
            "expected_install_cost_delta": self.expected_install_cost_delta,
            "feasibility_delta": self.feasibility_delta,
            "safety_delta": self.safety_delta,
            "explanation_diff_chars": self.explanation_diff_chars,
            "primary_top_id": self.primary_top_id,
            "shadow_top_id": self.shadow_top_id,
            "rules_version_match": self.rules_version_match,
            "model_version_notes": self.model_version_notes,
        }


def compare_shadow_outputs(
    primary: dict[str, Any],
    shadow: dict[str, Any],
    *,
    meta_primary: dict[str, Any] | None = None,
    meta_shadow: dict[str, Any] | None = None,
) -> ShadowComparison:
    """
    ``primary`` / ``shadow`` are recommendation response dicts with ``candidates`` list.
    Optional ``meta_*`` for versions, latency, explanations (flat dict).
    """
    pc = list(primary.get("candidates") or [])
    sc = list(shadow.get("candidates") or [])
    ids_p = _candidate_ids(pc)
    ids_s = _candidate_ids(sc)

    top1_match = bool(ids_p and ids_s and ids_p[0] == ids_s[0])
    top3 = top_k_overlap(ids_p, ids_s, 3)
    displacements = rank_displacement(ids_p, ids_s)
    avg_shift = average_rank_shift(displacements, top_n=min(10, len(ids_p)))

    scores_p = _scores(pc)
    scores_s = _scores(sc)
    s_delta = None
    if scores_p and scores_s:
        s_delta = scores_s[0] - scores_p[0]

    ord_div = sum(1 for i in range(min(len(ids_p), len(ids_s), 10)) if ids_p[i] != ids_s[i])

    def top_cand(cands: list[dict[str, Any]]) -> dict[str, Any]:
        return cands[0] if cands else {}

    tp = top_cand(pc)
    ts = top_cand(sc)
    temp_p = _get_num(tp, "expected_temp_reduction_c", "cooling_delta_c", "temp_reduction_c")
    temp_s = _get_num(ts, "expected_temp_reduction_c", "cooling_delta_c", "temp_reduction_c")
    temp_delta = (temp_s - temp_p) if temp_p is not None and temp_s is not None else None

    cost_p = _get_num(tp, "estimated_install_cost", "install_cost_usd", "cost_estimate")
    cost_s = _get_num(ts, "estimated_install_cost", "install_cost_usd", "cost_estimate")
    cost_delta = (cost_s - cost_p) if cost_p is not None and cost_s is not None else None

    feas_p = _get_num(tp, "feasibility_score", "feasibility")
    feas_s = _get_num(ts, "feasibility_score", "feasibility")
    feas_delta = (feas_s - feas_p) if feas_p is not None and feas_s is not None else None

    safe_p = _get_num(tp, "safety_score", "safety")
    safe_s = _get_num(ts, "safety_score", "safety")
    safe_delta = (safe_s - safe_p) if safe_p is not None and safe_s is not None else None

    expl_diff = None
    if meta_primary and meta_shadow:
        ex1 = meta_primary.get("explanation")
        ex2 = meta_shadow.get("explanation")
        e1 = str(ex1) if ex1 is not None else ""
        e2 = str(ex2) if ex2 is not None else ""
        expl_diff = abs(len(e1) - len(e2))

    rv_p = str((meta_primary or primary).get("rules_version") or "")
    rv_s = str((meta_shadow or shadow).get("rules_version") or "")
    rules_match = rv_p == rv_s if rv_p and rv_s else True

    mv_p = (meta_primary or primary).get("model_versions") or (meta_primary or primary).get("model_version")
    mv_s = (meta_shadow or shadow).get("model_versions") or (meta_shadow or shadow).get("model_version")
    mv_note = ""
    if mv_p != mv_s:
        mv_note = f"primary={mv_p!r} shadow={mv_s!r}"

    return ShadowComparison(
        exact_top1_match=top1_match,
        top3_overlap_count=top3,
        top_k_overlap={1: top_k_overlap(ids_p, ids_s, 1), 3: top3, 5: top_k_overlap(ids_p, ids_s, 5)},
        average_rank_shift=avg_shift,
        score_delta_top1=s_delta,
        ordering_divergence_count=ord_div,
        filtered_candidate_count_delta=len(sc) - len(pc),
        expected_temp_reduction_delta=temp_delta,
        expected_install_cost_delta=cost_delta,
        feasibility_delta=feas_delta,
        safety_delta=safe_delta,
        explanation_diff_chars=expl_diff,
        primary_top_id=ids_p[0] if ids_p else None,
        shadow_top_id=ids_s[0] if ids_s else None,
        rules_version_match=rules_match,
        model_version_notes=mv_note,
    )

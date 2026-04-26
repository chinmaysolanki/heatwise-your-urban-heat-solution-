"""
Build markdown summaries from shadow comparison dicts.
"""

from __future__ import annotations

from typing import Any


def build_shadow_markdown(
    title: str,
    comparison: dict[str, Any],
    *,
    experiment_id: str | None = None,
) -> str:
    lines = [f"## {title}", ""]
    if experiment_id:
        lines.append(f"- **experiment_id**: `{experiment_id}`")
    lines.extend(
        [
            f"- **exact_top1_match**: {comparison.get('exact_top1_match')}",
            f"- **top3_overlap_count**: {comparison.get('top3_overlap_count')}",
            f"- **average_rank_shift**: {comparison.get('average_rank_shift')}",
            f"- **score_delta_top1**: {comparison.get('score_delta_top1')}",
            f"- **filtered_candidate_count_delta**: {comparison.get('filtered_candidate_count_delta')}",
            f"- **expected_temp_reduction_delta**: {comparison.get('expected_temp_reduction_delta')}",
            f"- **expected_install_cost_delta**: {comparison.get('expected_install_cost_delta')}",
            f"- **feasibility_delta**: {comparison.get('feasibility_delta')}",
            f"- **safety_delta**: {comparison.get('safety_delta')}",
            f"- **rules_version_match**: {comparison.get('rules_version_match')}",
            "",
        ],
    )
    return "\n".join(lines)

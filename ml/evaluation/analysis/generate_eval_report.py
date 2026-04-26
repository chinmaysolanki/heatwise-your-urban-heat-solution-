#!/usr/bin/env python3
"""Generate markdown evaluation report from exposure + evaluation JSONL files."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from evaluation.governance.rollout_gates import evaluate_rollout_gate
from evaluation.monitoring.monitoring_metrics import aggregate_serving_from_exposures


def _load_jsonl(path: Path) -> list[dict]:
    rows: list[dict] = []
    if not path.is_file():
        return rows
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--experiment-id", required=True)
    ap.add_argument("--data-dir", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    ap.add_argument("-o", "--output", type=Path, required=True)
    args = ap.parse_args()

    eid = args.experiment_id
    exposures = _load_jsonl(args.data_dir / f"exposures_{eid}.jsonl")
    evals = _load_jsonl(args.data_dir / f"evaluations_{eid}.jsonl")

    serving = aggregate_serving_from_exposures(exposures)
    by_pt: dict[str, list] = defaultdict(list)
    for r in exposures:
        pt = str(r.get("project_type") or "unknown")
        by_pt[pt].append(r)

    snapshot = {
        "serving": serving.__dict__,
        "engagement_proxies": {},
        "gate_blockers": [],
        "unsafe_recommendation_count": 0,
        "baseline_p95_latency_ms": 800,
        "baseline_select_rate": 0.2,
    }
    gate = evaluate_rollout_gate(current_phase="shadow", metrics_snapshot=snapshot)

    lines = [
        f"# Evaluation report — `{eid}`",
        "",
        "## Experiment summary",
        f"- exposure_rows: {len(exposures)}",
        f"- evaluation_rows: {len(evals)}",
        "",
        "## Allocation / traffic",
        "- See `experiments.json` for configured traffic_allocation.",
        "",
        "## Serving metrics (from exposures)",
        f"- request_volume: {serving.request_volume}",
        f"- median_latency_ms: {serving.median_latency_ms:.1f}",
        f"- p95_latency_ms: {serving.p95_latency_ms:.1f}",
        f"- fallback_rate: {serving.fallback_rate:.4f}",
        "",
        "## Subgroup — project_type (counts)",
    ]
    for pt, rows in sorted(by_pt.items()):
        lines.append(f"- {pt}: {len(rows)}")

    lines.extend(
        [
            "",
            "## Guardrails",
            "- Review `alert_policy.md` thresholds vs aggregated snapshot.",
            "",
            "## Rollout gate (example, phase=shadow)",
            f"- outcome: **{gate.outcome}**",
            f"- reasons: {gate.reasons}",
            "",
            "## Recommendation",
            "- Continue shadow collection if gate is SHADOW_ONLY or HOLD with no regressions.",
            "- Pause or rollback if rollback triggers fire or guardrails breach.",
            "",
        ],
    )

    args.output.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()

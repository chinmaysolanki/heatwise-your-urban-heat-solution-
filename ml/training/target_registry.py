"""
Target definitions per v1 task (synthetic pretrain → later real-world labels).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

TaskName = Literal["feasibility", "heat_mitigation", "ranking"]


@dataclass(frozen=True, slots=True)
class TargetSpec:
    """Single training target."""

    name: str
    column: str
    task: TaskName
    dtype: str  # "float32" regression | "int64" binary/classification
    range_or_values: str
    description: str
    production_replacement: str


# --- Regression heads (synthetic heuristic today) ---
FEASIBILITY_TARGET = TargetSpec(
    name="feasibility",
    column="feasibility_score",
    task="feasibility",
    dtype="float32",
    range_or_values="[0, 1]",
    description="Synthetic structural/ops feasibility from bootstrap engine.",
    production_replacement="Installer sign-off + structural checklist outcome; optional 0/1 accept.",
)

HEAT_MITIGATION_TARGET = TargetSpec(
    name="heat_mitigation",
    column="heat_mitigation_score",
    task="heat_mitigation",
    dtype="float32",
    range_or_values="[0, 1]",
    description="Synthetic normalized cooling utility proxy.",
    production_replacement="Metered surface/air delta, user-reported comfort, or satellite/LST where available.",
)

# --- Ranking / selection ---
RANKING_PAIRWISE_TARGET = TargetSpec(
    name="pairwise_preference",
    column="preference_label",  # in ranking_pairs.csv
    task="ranking",
    dtype="int64",
    range_or_values="{0, 1} — v1 export uses 1 for preferred>other",
    description="Preferred candidate within same project (synthetic = rank order).",
    production_replacement="Implicit (clicks, saves) or explicit A/B; debias for position/context.",
)

RANKING_LISTWISE_PROXY_TARGET = TargetSpec(
    name="best_candidate",
    column="best_candidate",
    task="ranking",
    dtype="int64",
    range_or_values="{0,1}",
    description="Binary relevance for the top-ranked synthetic candidate.",
    production_replacement="Chosen plan ID vs shown alternatives; handle partial labels.",
)

TARGET_BY_TASK: Final[dict[str, TargetSpec | tuple[TargetSpec, ...]]] = {
    "feasibility": FEASIBILITY_TARGET,
    "heat_mitigation": HEAT_MITIGATION_TARGET,
    "ranking": (RANKING_PAIRWISE_TARGET, RANKING_LISTWISE_PROXY_TARGET),
}


def primary_target_column(task: str) -> str:
    if task == "feasibility":
        return FEASIBILITY_TARGET.column
    if task == "heat_mitigation":
        return HEAT_MITIGATION_TARGET.column
    if task == "ranking":
        return RANKING_LISTWISE_PROXY_TARGET.column
    raise ValueError(f"unknown task: {task}")

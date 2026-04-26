"""
Leakage-safe splits on ``leakage_group_id`` (fallback ``project_id``).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
import pandas as pd

SourceFilter = Literal[
    "all",
    "synthetic",
    "live_implicit",
    "live_explicit",
    "post_install_validated",
]


def resolve_group_column(df: pd.DataFrame) -> str:
    if "leakage_group_id" in df.columns:
        return "leakage_group_id"
    if "project_id" in df.columns:
        return "project_id"
    raise ValueError("pointwise frame needs leakage_group_id or project_id for splitting")


def filter_by_source(pointwise: pd.DataFrame, source_filter: SourceFilter) -> pd.DataFrame:
    if pointwise.empty or source_filter == "all":
        return pointwise.copy()

    df = pointwise.copy()
    if source_filter == "synthetic":
        return df[df.get("data_source", "") == "synthetic_bootstrap"].copy()

    if "data_source" not in df.columns or "label_confidence_tier" not in df.columns:
        return df.iloc[0:0].copy()

    live = df["data_source"] == "live_telemetry"
    if source_filter == "live_implicit":
        return df[live & (df["label_confidence_tier"] == "implicit_feedback_derived")].copy()
    if source_filter == "live_explicit":
        return df[live & (df["label_confidence_tier"] == "explicit_feedback_derived")].copy()
    if source_filter == "post_install_validated":
        return df[df["label_confidence_tier"] == "post_install_validated"].copy()

    return df


@dataclass
class SplitPack:
    train: pd.DataFrame
    val: pd.DataFrame
    test: pd.DataFrame
    group_col: str
    train_groups: set[str]
    val_groups: set[str]
    test_groups: set[str]


def split_by_group(
    pointwise: pd.DataFrame,
    *,
    group_col: str | None = None,
    train_ratio: float = 0.7,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    seed: int = 42,
) -> SplitPack:
    """Assign entire groups to train / val / test (no candidate leakage within a site)."""
    if pointwise.empty:
        return SplitPack(
            train=pointwise.copy(),
            val=pointwise.copy(),
            test=pointwise.copy(),
            group_col=group_col or "project_id",
            train_groups=set(),
            val_groups=set(),
            test_groups=set(),
        )

    gc = group_col or resolve_group_column(pointwise)
    if gc not in pointwise.columns:
        raise ValueError(f"missing group column {gc}")

    groups = pointwise[gc].dropna().astype(str).unique()
    rng = np.random.default_rng(seed)
    rng.shuffle(groups)

    n = len(groups)
    n_train = int(round(train_ratio * n))
    n_val = int(round(val_ratio * n))
    # remainder → test
    g_train = set(groups[:n_train])
    g_val = set(groups[n_train : n_train + n_val])
    g_test = set(groups[n_train + n_val :])

    tr = pointwise[pointwise[gc].astype(str).isin(g_train)].copy()
    va = pointwise[pointwise[gc].astype(str).isin(g_val)].copy()
    te = pointwise[pointwise[gc].astype(str).isin(g_test)].copy()

    return SplitPack(
        train=tr,
        val=va,
        test=te,
        group_col=gc,
        train_groups=g_train,
        val_groups=g_val,
        test_groups=g_test,
    )


def filter_pairs_by_train_groups(
    pairs: pd.DataFrame,
    split_pack: SplitPack,
    *,
    session_col: str = "recommendation_session_id",
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split pairwise rows: synthetic by project_id; live by session mapped to groups via pointwise."""
    if pairs.empty:
        return pairs.copy(), pairs.copy(), pairs.copy()

    p = pairs.copy()
    gc = split_pack.group_col

    def _in_split(df: pd.DataFrame, group_set: set[str]) -> pd.Series:
        if "data_source" in df.columns:
            syn = df["data_source"] == "synthetic_bootstrap"
            if gc in df.columns:
                return syn & df[gc].astype(str).isin(group_set)
            return pd.Series(False, index=df.index)

        return pd.Series(False, index=df.index)

    # Synthetic pairs: project_id in group sets
    mask_tr = pd.Series(False, index=p.index)
    mask_va = pd.Series(False, index=p.index)
    mask_te = pd.Series(False, index=p.index)

    if "project_id" in p.columns:
        syn = p.get("data_source", pd.Series("synthetic_bootstrap", index=p.index)) == "synthetic_bootstrap"
        pid = p["project_id"].astype(str)
        mask_tr = mask_tr | (syn & pid.isin(split_pack.train_groups))
        mask_va = mask_va | (syn & pid.isin(split_pack.val_groups))
        mask_te = mask_te | (syn & pid.isin(split_pack.test_groups))

    # Live pairs: join session → leakage_group from pointwise (use train pointwise map)
    if session_col in p.columns and not split_pack.train.empty:
        live = p.get("data_source", "") == "live_telemetry" if "data_source" in p.columns else pd.Series(True, index=p.index)
        # Build session → group from full pointwise used for split
        pm = pd.concat([split_pack.train, split_pack.val, split_pack.test], ignore_index=True)
        if session_col in pm.columns and gc in pm.columns:
            mp = pm.dropna(subset=[session_col]).drop_duplicates(subset=[session_col])
            sid_to_g = dict(zip(mp[session_col].astype(str), mp[gc].astype(str), strict=False))
            g_live = p[session_col].astype(str).map(sid_to_g)
            mask_tr = mask_tr | (live & g_live.isin(split_pack.train_groups))
            mask_va = mask_va | (live & g_live.isin(split_pack.val_groups))
            mask_te = mask_te | (live & g_live.isin(split_pack.test_groups))

    return p[mask_tr].copy(), p[mask_va].copy(), p[mask_te].copy()

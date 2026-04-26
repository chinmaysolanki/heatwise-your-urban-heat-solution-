# Hybrid dataset — label policy (v1, auditable)

This document is the **source of truth** for how labels and tiers are assigned before v2 retraining. Code in `build_hybrid_dataset.py` must match this policy or declare an intentional deviation in release notes.

## 1. Provenance fields (every pointwise row)

| Field | Meaning |
|-------|---------|
| `data_source` | `synthetic_bootstrap` \| `live_telemetry` |
| `label_confidence_tier` | One of four tiers below |
| `weighting_policy_version` | e.g. `hw-hybrid-weights-v1` |
| `label_policy_version` | e.g. `hw-hybrid-labels-v1` |
| `record_id` | Stable hash or UUID-like string for dedupe audits |

## 2. Confidence tiers (ordinal trust)

Ordered from **weakest** to **strongest** supervision:

### A. `synthetic_heuristic`

- **Source:** Bootstrap generator (`joined_training_table.csv` / ranking pack).
- **Labels:** Rank positions, scores, `best_candidate`, `long_term_success_likelihood`, etc. are **simulator-defined**, not observed.
- **Use:** Architecture, cold start, regularization toward feasible plans.

### B. `implicit_feedback_derived`

- **Source:** Live telemetry events without explicit preference declaration.
- **Event types counted as implicit:** `recommendation_impression`, `candidate_viewed`, `recommendation_view`, `recommendation_run_viewed`, `recommendation_expand`, `recommendation_compare`, `recommendation_share`, `recommendation_dismiss`, `candidate_dismissed`, `recommendation_request_*`, `visualization_requested`, `report_opened`, `installer_export_requested`, `recommendation_unsave` (ambiguous), `recommendation_request_regenerate` (session-level frustration — does not upgrade tier without candidate id).
- **Label construction:** Heuristic scores from `live_data` `EVENT_WEIGHT` table; normalized to `pointwise_relevance_score` in \[0, 1\] via min–max within session (if ≥2 candidates) else raw sigmoid-style scale.
- **Caveat:** Strong **position / UI** confounding; treat as weak labels.

### C. `explicit_feedback_derived`

- **Trigger:** At least one of on `(recommendation_session_id, candidate_snapshot_id)`:
  - `recommendation_select`
  - `recommendation_save`
  - `recommendation_feedback_positive`
  - `recommendation_feedback_negative`
- **Tier assignment:** If **only** explicit negatives without positives on slate, still `explicit_feedback_derived` (strong signal, negative polarity encoded in features/weights downstream).
- **Overrides implicit** for that candidate in the same session.

### D. `post_install_validated`

- **Trigger:** `install_outcomes.install_status == completed` AND `selected_candidate_snapshot_id` equals this row’s `candidate_key` AND `recommendation_session_id` links to that outcome (via `telemetry_session_id` or session id column).
- **Overrides** explicit and implicit for that candidate.
- **Optional quality flags** (do not change tier, only weight multipliers): non-null `measured_temp_change_c`, `plant_survival_rate_90d`, `user_satisfaction_score`.

## 3. Pointwise targets (three-task setup)

| Column | Task | Synthetic | Live |
|--------|------|-----------|------|
| `pointwise_relevance_score` | Pointwise scoring / regression | `overall_recommendation_score` scaled 0–1 if present | Normalized heuristic + install boost proxy |
| `pointwise_binary_relevant` | Classification | `best_candidate` | 1 if select/save/positive or post-install selected; 0 if only negative explicit; else null if unknown |
| `outcome_success_proxy` | Outcome head | `long_term_success_likelihood` | Blend of satisfaction, survival, temp delta when present; else null |

**Nulls** are allowed for live rows with insufficient signal; filters are the trainer’s responsibility.

## 4. Pairwise labels (`hybrid_ranking_pairs.csv`)

- **Synthetic:** Copy from `ranking_pairs.csv`; `preference_label = 1`; tier `synthetic_heuristic`.
- **Live:** From `live_ranking_pairs.csv` (heuristic score ordering).  
- **`pair_confidence_tier`:**  
  - `post_install_validated` if the **preferred** candidate is the completed-install selection for that session.  
  - Else `explicit_feedback_derived` if **either** endpoint candidate has an explicit event in that session.  
  - Else `implicit_feedback_derived`.
- **Leakage:** Pairs are only emitted within the same `recommendation_session_id` (live) or `project_id` (synthetic). Never cross-session.

## 5. Outcome prediction table (`hybrid_outcome_rows.csv`)

- **Live:** One row per `install_outcome` record (by stable id or composite key); targets from measured/survey fields; `row_weight` from tier + measurement multipliers.
- **Synthetic:** Optional subset (e.g. all rows) with `long_term_success_likelihood` as pseudo-target; tier `synthetic_heuristic`; low weight.

## 6. Dedupe rules

| Scope | Key | Action |
|-------|-----|--------|
| Synthetic pointwise | `(data_source, project_id, candidate_id)` | Keep first by file order |
| Live pointwise | `(data_source, recommendation_session_id, candidate_key)` | Keep first |
| Pairwise | `(data_source, project_id, preferred_candidate_id, other_candidate_id, session_scope)` | Drop exact duplicates |

`record_id = sha256(f"{data_source}|{project_id}|{candidate_key}|{recommendation_session_id or ''}")` for audit (truncated display ok).

## 7. Leakage protections

1. **Split by `leakage_group_id`:** `project_id` for both sources; for live without stable project, use `recommendation_session_id` as provisional group (document that session-level split is stricter than user-level).
2. **Optional manifest:** CSV columns `leakage_group_id`, `split` (`train` \| `val` \| `test`). Builder filters rows to one split per run, or emits all with `split` attached **without** cross-split duplicate groups.
3. **Synthetic vs live:** Do not assume disjoint IDs; collisions are unlikely (synthetic `PRJ-*`). If collision detected, **fail fast** or namespace with `data_source` prefix in `record_id` only — never silently merge.

## 8. Auditing

- Retention: keep raw JSONL/CSV inputs alongside `hybrid_manifest.json` (run metadata, git sha, policy versions).
- Any change to tiers or weights requires bumping `label_policy_version` / `weighting_policy_version` and a row in this file’s changelog (append-only section below).

### Changelog

- **hw-hybrid-labels-v1** — Initial policy (synthetic + live + four tiers + pairwise + outcome table).
- **hw-hybrid-labels-v2** — Phase 7: canonical telemetry types (`candidate_*`, run/report/install surfaces) included in explicit/implicit triggers; tier logic unchanged; use `telemetry_labeling.py` + `EVENT_WEIGHTING.md` for heuristic scores.

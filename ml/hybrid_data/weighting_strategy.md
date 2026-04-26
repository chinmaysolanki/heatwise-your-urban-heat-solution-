# Hybrid dataset — row weighting strategy (v2)

Phase 7 bumps `weighting_policy_version` to **hw-hybrid-weights-v2** (aligned with `hw-hybrid-labels-v2`). Base tier weights are unchanged; tier **assignment** now recognizes canonical telemetry event types via `live_data/telemetry_labeling.py`.

Weights scale the contribution of each row in **weighted** losses (e.g. weighted MSE, weighted pairwise hinge). They do **not** change the stored label values.

## Base weights by confidence tier

| `label_confidence_tier`      | Base weight | Rationale |
|-----------------------------|------------|-----------|
| `synthetic_heuristic`       | 0.35       | Simulator prior; high volume, unknown sim-to-real gap. |
| `implicit_feedback_derived` | 0.75       | Behavioral weak supervision; position/UI confounding. |
| `explicit_feedback_derived` | 1.20       | Saves, selects, thumbs — user intent clearer. |
| `post_install_validated`    | 2.25       | Real execution + optional measurements; strongest signal. |

## Multipliers (multiplicative, clamped)

Applied after base weight. Document every multiplier you add in `label_policy.md`.

| Condition | Multiplier | Notes |
|-----------|------------|--------|
| Live row with `install_status == completed` and row is the **selected** candidate snapshot | ×1.15 | On top of tier weight if tier is already `post_install_validated`, use **max(1.0, mult)** so we do not double-count absurdly — implementation uses tier-specific caps. |
| Outcome row with any of `measured_temp_change_c`, `plant_survival_rate_90d`, `user_satisfaction_score` non-null | ×1.10 | Measured / stated outcomes increase trust. |
| Synthetic row with `best_candidate == 1` | ×1.0 | No boost (ranking already encoded); optional future: ×1.05 for balance. |

## Pairwise row weights

For `hybrid_ranking_pairs.csv`:

\[
w_{\text{pair}} = \sqrt{w_{\text{preferred}} \cdot w_{\text{other}}}
\]

Then multiply by **0.85** if `pair_confidence_tier == implicit_feedback_derived` (conservative for noisy pairs).

Synthetic pairs use endpoint weights from synthetic pointwise rows (same base 0.35).

## Caps

- Final `row_weight` is clipped to **[0.05, 5.0]** to avoid single rows dominating early training.
- Tune bases from validation on **held-out explicit + install** cohorts before production retrains.

## Versioning

Bump `weighting_policy_version` in dataset outputs when this file changes.

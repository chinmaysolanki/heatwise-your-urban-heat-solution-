# Recommendation engine layout (canonical vs archive)

| Path | Role |
|------|------|
| **`heatwise/recommendation-engine/`** | **Canonical** rules/layout pipeline: spatial mapping, templates, feedback (`@/recommendation-engine`). Used by AR, `generate-layout`, and related APIs. |
| **`heatwise/recommendation engine/`** (space) | **Removed copy** — kept only as this pointer so old paths do not get recreated by mistake. Do not add TypeScript here; `tsconfig` used to exclude it. |

ML **ranking** lives under `heatwise/ml/serving/` and is orchestrated from Node via `generateRecommendationsRuntime` — see [RECOMMENDATION_STACKS.md](./RECOMMENDATION_STACKS.md).

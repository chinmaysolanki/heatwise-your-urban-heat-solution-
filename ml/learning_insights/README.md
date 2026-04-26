# Learning insights & experiment memory

## Why learning insights matter

Raw **telemetry** tells you *what happened*; learning insights turn cross-system signals into **repeatable slices** (variants, segments, outcomes) so product, ML, and ops can prioritize fixes and training data without ad-hoc SQL each week.

## Raw telemetry vs internal lessons

- **Telemetry / rollups** (`RecommendationInsight`, `VariantPerformance`, `SegmentPerformance`): quantitative, windowed, reproducible from DB joins.  
- **Lesson memory** (`LessonMemory`): curated **structured** judgments (“tends to work / fail / mixed”) with **mandatory evidence references** (layer + id). Lessons are not free-text doctrine; they are auditable records for humans and downstream policy.

## Structured, auditable lesson memory

Each lesson has `summaryStructuredJson` (JSON object—bullets, tags, metrics), `evidenceRefsJson` (array of `{ layer, id, type? }` pointing at telemetry, verified installs, dossiers, commercial rows, etc.), optional `relatedSegmentKey`, and validity window (`effectiveFrom` / `effectiveTo`). Updates bump `updatedAt`; keys are unique via `lessonKey`.

## Continuous improvement

- **Segment performance** highlights weak buckets (climate × budget × region × …).  
- **Variant rollups** compare generator/rules/model × recommendation type (experiment id / `rolloutVariant` reserved for when assignment is persisted on sessions).  
- **Insights API** joins verified outcomes, follow-ups, dossiers, and commercial “installed” counts for the same window.  
- **Exporters** feed notebooks, retraining cohorts, and exec dashboards.

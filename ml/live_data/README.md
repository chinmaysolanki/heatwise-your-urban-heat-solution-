# HeatWise live data layer (v1)

## Why this exists

Synthetic bootstrap data seeds models and rules, but **production learning** needs append-only telemetry: what was generated, what users saw, what they did, what installers executed, and measured outcomes. This package defines **schemas**, **validators**, **feature mappers**, and **exporters** so live app data can be validated offline and merged into retraining pipelines without rewriting the ML stack.

## Raw telemetry vs training exports

| Layer | Role |
|--------|------|
| **Database / JSONL dumps** | Source of truth: sessions, frozen candidate snapshots, events, outcomes. Append-only for events. |
| **`export_feedback_dataset.py`** | Normalizes dumps → wide CSV tables + simple implicit aggregates (e.g. max dwell per session–candidate). |
| **`export_training_dataset.py`** | Builds **derived** tables with **documented heuristics** (weak supervision), not learned weights. |

Training exports are reproducible given the same CSV inputs. **Phase 7:** heuristic weights and canonical/legacy resolution live in `telemetry_labeling.py`; see `EVENT_WEIGHTING.md`. Exports include `live_feedback_events_enriched.csv` (`canonical_event`, `learning_weight`) and candidate `species_catalog_codes_joined` when snapshot payload is present.

## Event lifecycle

1. **Recommendation run** — API creates a `RecommendationTelemetrySession` with JSON snapshots (project / environment / preference) and `model_version` / `rules_version` / `generator_source`.
2. **Candidates** — Each shown option is stored as a `RecommendationCandidateSnapshot` (immutable payload as served).
3. **Impressions & interactions** — `RecommendationTelemetryEvent` rows record impressions, views, saves, compares, etc. **Never update** past events; new row for new signal.
4. **Selection** — `candidate_selected` / `recommendation_select` (and optional downstream “saved solution” in product DB) links the user’s choice to `candidate_snapshot_id`. Events may carry `metadata.canonicalEvent` and `recommendationRunId` for exports.
5. **Install outcome** — `InstallOutcomeRecord` captures status, costs, species installed, deviations, satisfaction, and measured cooling/survival when available.

## Coexistence with synthetic data

- **Synthetic rows** keep stable column names from the bootstrap generator.
- **Live rows** use `mappers/project_feature_mapper.py` and `mappers/recommendation_snapshot_mapper.py` to align enums and keys; unknown categories map to `__unknown__` while **raw JSON** remains in snapshot columns for audit.
- Retraining can **concat** live exports with synthetic tables, or train on live-only once volume allows; always keep `generator_source` and version fields for filtering.

## Using exports for retraining

### From Prisma (HeatWise repo)

From `heatwise/` with SQLite (`DATABASE_URL=file:./dev.db` is resolved relative to the `prisma/` folder → `prisma/dev.db`):

```bash
npm run db:migrate
npm run ml:telemetry-audit
npm run ml:export-telemetry-pipeline
# Optional: point Python at dumps/latest/csv (or use --out …)
```

Implementation: `scripts/export-telemetry-for-ml.ts` + `lib/ml/exportTelemetryPipeline.ts`. Legacy `RecommendationFeedbackEvent` rows are bridged into synthetic telemetry sessions when not using `--no-legacy-bridge`.

### Manual JSONL / CSV

```bash
cd heatwise/ml/live_data
pip install -r requirements.txt

# 1) Produce JSONL from DB (your ETL / script; one object per line)
#    recommendation_sessions.jsonl, candidate_snapshots.jsonl,
#    feedback_events.jsonl, install_outcomes.jsonl

python exporters/export_feedback_dataset.py \
  --input-dir ./dumps/jsonl \
  --output-dir ./dumps/csv

python exporters/export_training_dataset.py \
  --feedback-csv-dir ./dumps/csv \
  --output-dir ./dumps/training
```

Outputs:

- From **feedback** exporter: `recommendation_sessions.csv`, `candidate_snapshots.csv`, `feedback_events.csv`, `install_outcomes.csv`, optional `implicit_signal_aggregates.csv`.
- From **training** exporter: `live_project_features.csv`, `live_candidate_features.csv`, `live_outcome_labels.csv`, `live_ranking_pairs.csv`, `live_joined_training_table.csv`.

## Explicit vs implicit signals → future labels

**Explicit** (high trust): thumbs up/down, save, select, post-install satisfaction, installer feasibility rating.

**Implicit** (noisy but scalable): impression/view, expand, compare, dwell time, share, AR / before-after / installer requests, regenerate after low engagement, dismiss.

**How to turn these into supervision later (scoring note):**

- **Acceptance labels** — `recommendation_select` and `recommendation_save` as positives; `recommendation_dismiss` and strong negative dwell patterns as soft negatives.
- **Ranking preference pairs** — Training exporter uses a fixed `EVENT_WEIGHT` table: e.g. select > save > long expand > view > impression > dismiss. Pairs are emitted only when heuristic scores differ (conservative).
- **Weak-supervision scores** — Weighted sum of max event weight per (session, candidate); post-install **completed** with matching `selected_candidate_snapshot_id` adds a fixed boost so executed success upweights the chosen card.
- **Long-term success labels** — From `install_outcome`: satisfaction, measured temp change, survival rates, maintenance adherence (nullable fields tolerated).

Refine weights using held-out explicit labels; do not treat heuristics as ground truth.

## Validators (Python)

- `validators/validate_project_payload.py` — Project ingestion + recommendation session create; duplicate `feedback_event_id` hook for batches.
- `validators/validate_feedback_payload.py` — Event enum, ISO timestamps, non-negative dwell; **warn-level** rule: several event types should include `candidate_snapshot_id` for training quality.
- `validators/validate_install_outcome.py` — `completed` ⇒ `install_date`; survival in \[0,1\]; plausible temp deltas.

## Tests

```bash
pip install -r requirements-dev.txt
pytest tests/
```

## Caveats and assumptions

- JSONL → CSV column names may be **snake_case** (Python ETL) or **camelCase** (Prisma default). Exporters accept common aliases where noted in code.
- Ranking pairs are **heuristic**; sparse events yield few or no pairs.
- Install outcomes are often **partial**; validation allows nullable fields except where business rules apply (`completed` + date).
- **Auth / PII**: scrub before sharing exports outside secure storage; this package does not anonymize.

---

## Integration (HeatWise repo)

### Directory tree (`ml/live_data`)

```
ml/live_data/
  README.md
  requirements.txt
  requirements-dev.txt
  schemas/
    project_ingestion_schema.json
    recommendation_event_schema.json
    feedback_event_schema.json
    install_outcome_schema.json
  validators/
    validate_project_payload.py
    validate_feedback_payload.py
    validate_install_outcome.py
  mappers/
    project_feature_mapper.py
    recommendation_snapshot_mapper.py
  exporters/
    export_feedback_dataset.py
    export_training_dataset.py
  tests/
    conftest.py
    test_project_validation.py
    test_feedback_validation.py
    test_exporters.py
```

### Backend (Next.js / Prisma)

- **Models**: `RecommendationTelemetrySession`, `RecommendationCandidateSnapshot`, `RecommendationTelemetryEvent`, `InstallOutcomeRecord` in `prisma/schema.prisma` (run `prisma migrate dev` to apply migrations).
- **Services**: `heatwise/lib/services/recommendationTelemetryService.ts`, `feedbackLoggingService.ts`, `installOutcomeService.ts`.
- **Shared types / validation**: `heatwise/lib/recommendationTelemetryTypes.ts`, `recommendationTelemetryValidation.ts`, `recommendationTelemetryConstants.ts`.

### API routes (`pages/api/recommendations/`)

| Route | Purpose |
|--------|---------|
| `create-session.ts` | Create session + candidate snapshots |
| `log-impression.ts` | Candidate shown |
| `log-interaction.ts` | Generic interaction |
| `submit-feedback.ts` | Maps sentiment → positive/negative events |
| `mark-selected.ts` | `recommendation_select` + metadata |
| `submit-install-outcome.ts` | Post-install record |

### Sample feedback event (JSON)

```json
{
  "feedback_event_id": "fe_01HZX…",
  "recommendation_session_id": "sess_01HZX…",
  "candidate_snapshot_id": "snap_01HZX…",
  "project_id": "proj_123",
  "user_id": "usr_456",
  "event_type": "recommendation_expand",
  "event_timestamp": "2025-03-27T12:00:00Z",
  "event_source": "ios",
  "screen_name": "RecommendationsCarousel",
  "ui_position": 2,
  "dwell_time_ms": 4200,
  "metadata": { "scroll_depth": 0.8 }
}
```

### Sample install outcome (JSON)

```json
{
  "project_id": "proj_123",
  "user_id": "usr_456",
  "telemetry_session_id": "sess_01HZX…",
  "selected_candidate_snapshot_id": "snap_01HZX…",
  "install_status": "completed",
  "install_date": "2025-04-15T10:00:00+05:30",
  "actual_install_cost_inr": 45000,
  "installed_area_sqft": 180,
  "user_satisfaction_score": 0.85,
  "measured_temp_change_c": -2.1,
  "plant_survival_rate_90d": 0.92
}
```

### Sample exported rows (conceptual)

**`feedback_events.csv`**: one row per event; preserve `model_version` on session join in analytics DB.

**`live_ranking_pairs.csv`**: `recommendation_session_id`, `preferred_candidate_id`, `other_candidate_id`, `heuristic_score_preferred`, `heuristic_score_other`, `project_id`.

### Synthetic → real learning loop

1. Bootstrap model trained on synthetic CSVs.
2. Production serves recommendations; **same feature mapper** maps live snapshots toward synthetic column names.
3. Events and outcomes accumulate; exporters build ranking pairs and labels.
4. Retrain ranker or calibrate rules using merged data, gated by `generator_source` and version columns.

### Top risks before production retraining

- **Volume and bias** — Early users may not represent all climates; monitor label imbalance.
- **Idempotency** — Clients must send stable `feedback_event_id` / install `idempotency_key` to avoid duplicate rows (APIs support deduplication).
- **Attribution** — Weak supervision from implicit signals confounds position/UI; consider position features or inverse propensity later.
- **ETL gap** — You still need a small **DB → JSONL** job (or direct CSV export) matching the field names expected by the Python exporters.
- **Privacy / consent** — Logged payloads may contain location or photos metadata; define retention and access controls outside this package.

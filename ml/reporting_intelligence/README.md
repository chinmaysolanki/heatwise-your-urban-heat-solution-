# Reporting intelligence & recommendation dossiers

## Dossier purpose

A **recommendation dossier** is a **frozen, structured** bundle tied to a `RecommendationTelemetrySession`: project/environment/preference snapshots, candidate snapshot IDs, tiered summaries (pricing, supply, geo, personalization, scenarios), and **ordered report sections** with **explanation provenance**. It is the canonical artifact for **user PDFs**, **installer execution packs**, **admin review**, and **warehouse exports**—without replacing the live recommender.

## User vs installer vs admin vs scenario outputs

| Output | Dossier type | Visibility | Emphasis |
|--------|----------------|------------|----------|
| User report | `user_final_recommendation` | `user` + `shared` | Costs, maintenance, cooling, preferences, geo, phasing |
| Installer summary | `installer_execution_summary` | `installer` + `shared` | Execution notes, supply/logistics, checklist row |
| Admin review | `admin_internal_review` | `admin` | Full sections + `admin_risk_review` + `AdminReviewDossier` slice |
| Scenario pack | `scenario_comparison_pack` | `user` + `shared` | Tradeoffs, phased plans, multi-candidate comparison |

## Explanation provenance philosophy

Each major section can have multiple `ReportExplanation` rows: **source_layer** (`rules`, `ml_model`, `pricing`, `supply_intelligence`, `personalization`, `geospatial`, `installer_ops`, `verified_outcomes`, `scenario_engine`), optional **source_reference_id**, **confidence_band**, and a **structured JSON payload** (no LLM narrative in v1). Corrections append new rows; sections are versioned by **dossier_version**.

## Future PDF / document generation

Renderers map `section_key` → template blocks; `visibility_scope` gates content; `explanation_provenance_json` on the dossier provides a **manifest** for footnotes and audit columns.

## Visibility / scoping rules

- **`user`**: end-customer safe; no internal risk flags by default.  
- **`installer`**: execution and logistics.  
- **`admin`**: risk, budget fit dumps, full provenance.  
- **`shared`**: safe for both user and installer (e.g. recommendation overview, supply headline).  

APIs apply filters in `userReportService`, `installerSummaryService`, and `adminReviewDossierService`; `report-preview` returns **unfiltered** data for ops.

## Prisma / API field mapping

Python schemas and CSV exporters use **snake_case** ids aligned with logical columns. Prisma models use **camelCase**:

| Logical / CSV | Prisma `RecommendationDossier` |
|---------------|----------------------------------|
| `recommendation_dossier_id` | `id` |
| `project_id` | `projectId` |
| `user_id` | `userId` |
| `recommendation_session_id` | `recommendationSessionId` |
| `candidate_snapshot_ids_json` | `candidateSnapshotIdsJson` |
| `selected_candidate_snapshot_id` | `selectedCandidateSnapshotId` |
| `generated_at` | `generatedAt` (ISO-8601) |
| `dossier_type` | `dossierType` |
| `dossier_version` | `dossierVersion` |
| `project_context_snapshot_json` | `projectContextSnapshotJson` |
| `recommendation_summary_json` | `recommendationSummaryJson` |
| `explanation_provenance_json` | `explanationProvenanceJson` |
| … | … |

Use `mappers.report_payload_mapper.map_ts_dossier_row_to_canonical` when piping Prisma JSON exports into validators or JSONL bundles.

## Validators & exports

- `validate_recommendation_dossier` — JSON Schema + candidate list checks + **exact** section-key set per `dossier_type` (see `section_blueprint.py`, kept in sync with `lib/reportingConstants.ts`).
- `validate_section_ordering` — `section_order` must be `0..n-1` with no gaps or duplicates.
- `validate_dossier_export_bundle` — dossier + all sections + explanations; explanations must reference a present `section_key`.
- CLI: `python -m reporting_intelligence.exporters.export_report_payloads --input bundle.jsonl --out-dir ./out` (run with `PYTHONPATH` set to `heatwise/ml`).

## Warehouse / analytics

Ops can dump dossiers via API or DB export → JSONL lines `{ "dossier", "sections", "explanations", "installer_summary", "admin_review" }` → CSVs under `exporters/`.

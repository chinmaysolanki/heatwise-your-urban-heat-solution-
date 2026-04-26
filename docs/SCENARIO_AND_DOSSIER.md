# “Scenario” vs dossier / report

In HeatWise, **“scenario”** in analytics and learning-insights code refers to **summaries attached to dossiers and reports** (e.g. `scenario_usage_tag`, `report_dossier_type` on variant performance rows) — not a separate public “scenario API”.

- **Dossier / report flows** persist structured snapshots (project, environment, preferences, geo/supply provenance where enabled) for audit and ML exports.
- **API surface:** Use existing recommendation generate + create-session + reporting endpoints; treat “scenario” as **metadata on persisted dossier/report artifacts**, unless a future thin `scenario` resource is explicitly added.
- **Discovery:** `GET /api/recommendations/scenario-context` returns this framing as JSON for clients and installers.
- **Persisted contract:** Default `scenarioSummaryJson` on dossiers uses `schema_version: "hw_scenario_summary_v1"` (`lib/scenarioSummaryContract.ts`) — a small structured summary tied to phased-plan / estimate IDs, not a second orchestration engine.

This avoids ambiguity without building a second orchestration layer.

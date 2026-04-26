# HeatWise verified outcomes & installer operations

This package defines **schemas**, **validators**, **mappers**, and **CSV exporters** for the highest-confidence learning signal: **what was actually installed** and **what outcomes were verified**, not only what the model recommended.

## Why verified installs are the strongest labels

Recommendations are *hypotheses* under constraints. An **installer-confirmed as-built record** (`verified_install`) ties a specific **job**, **snapshot context**, and **physical configuration**. When combined with **outcome verification** (measured temps, survival, satisfaction) at an appropriate **confidence tier**, we get traceable ground truth for:

- feasibility and safety in the real world  
- cost and timeline realism  
- heat-mitigation effectiveness (where instrumented)  
- species and maintenance fit  

## Recommended vs actual

- **Recommended**: candidate card + telemetry session snapshots (immutable at request time).  
- **Actual**: `verified_install` — solution type, area, species/materials JSON, irrigation/shade/planter choices.  
- **Mismatch**: `mismatch_reason_codes_json` uses the canonical enum in `schemas/mismatch_reason_codes.json` (budget, structure, stock, user change, compliance, etc.).

Mismatch codes are **first-class training features**: they explain *why* the pipeline diverged from the card, not only *that* it did.

## Confidence tiers

`outcome_verification.verification_confidence_tier`: `low` | `medium` | `high` | `gold`.

- **gold / high**: suitable for hard label weighting in retraining (policy-dependent).  
- **low**: exploratory / UI analytics; down-weight or filter in `hybrid_data` joins.

## Flow into retraining

1. App + ops APIs persist Prisma rows (`InstallerInstallJob`, `VerifiedInstallRecord`, `OutcomeVerificationRecord`).  
2. ETL exports JSON bundle (or query DB) and runs:

   ```bash
   cd heatwise/ml
   PYTHONPATH=. python -m verified_outcomes.exporters.export_verified_training_labels bundle.json -o ./export_out/
   PYTHONPATH=. python -m verified_outcomes.exporters.export_installer_performance bundle.json -o ./export_perf/
   ```

3. `verified_labels.csv` carries **rule-mapped** columns from `mappers/outcome_label_mapper.py` (`label_rules_version` for reproducibility).  
4. `ml/retraining` / `ml/hybrid_data` ingest these alongside telemetry and bootstrap data.

## Limitations (v1)

- No marketplace payments, scheduling UI, or per-installer OAuth — **data integrity first**.  
- Installer auth is **ops token / admin** on write paths; tighten before external installer self-serve.  
- Region matching is **heuristic** (list overlap / substring).  
- `InstallOutcomeRecord` (legacy) can coexist; prefer linking new verified pipeline rows for new installs.

## Python layout

| Path | Role |
|------|------|
| `schemas/*.json` | JSON Schema docs + contract reference |
| `validators/*.py` | Payload and state checks |
| `mappers/outcome_label_mapper.py` | Explicit training labels (documented rules) |
| `mappers/verified_install_mapper.py` | Shape normalization for exports |
| `exporters/*.py` | CSV for training & installer analytics |

## Installer performance metrics

`export_installer_performance.py` produces **descriptive** CSVs (acceptance, completion, mismatch frequency, satisfaction). They are **signals for governance**, not automatic ranking unless product policy explicitly enables that.

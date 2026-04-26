# HeatWise longitudinal follow-up & remeasurement

Tracks **post-install outcomes over time** via scheduled checkpoints (default **7d / 30d / 90d / 180d**), **follow-up events** (completed, missed, rescheduled, unreachable), and **remeasurements** (repeat quantitative + qualitative signals).

## Follow-up lifecycle

1. **Baseline** — Anchor date (e.g. install job `completedAt`, or `verifiedAt` on `VerifiedInstallRecord`).  
2. **Schedule** — `LongitudinalFollowupSchedule` + one `LongitudinalFollowupCheckpoint` per offset (`dueAt = baseline + offsetDays`).  
3. **Operations** — Before/on/after due date: log `LongitudinalFollowupEvent` (`completion`, `missed`, `rescheduled`, `unreachable`, `qualitative_note`). Checkpoint status is updated to match.  
4. **Remeasurement** — `LongitudinalRemeasurement` rows capture repeated metrics (`plantSurvivalRate`, `surfaceTempDeltaC`, satisfaction, maintenance, heat stability proxy) per window label (`7d`, `30d`, …).  
5. **Export** — `exporters/export_longitudinal_labels.py` builds **time-windowed training labels** (trends, delayed failure, stability) for `ml/retraining` / hybrid joins.

## Relationship to verified outcomes

- Optional link: `verifiedInstallId` on the schedule ties follow-ups to as-built truth.  
- Complements `OutcomeVerificationRecord` (often a single strong snapshot); longitudinal data captures **trajectory**.

## Auth (API v1)

- **create-schedule**: project owner session (or ops token — see handler).  
- **log-followup-event**, **submit-remeasurement**, **due-followups**: `HEATWISE_OPS_TOKEN` + `x-heatwise-ops-token` or admin session (`lib/opsAuth.ts` / `lib/adminAuth.ts`).

## Python usage

```bash
cd heatwise/ml
PYTHONPATH=. python -m longitudinal_tracking.exporters.export_longitudinal_labels bundle.json -o ./long_export/
```

`bundle.json` should list `schedules`, `checkpoints`, `events`, `remeasurements` (Prisma-shaped dicts).

## Label rules version

Exported CSV includes `longitudinal_label_rules_version` so retraining can filter or recompute when thresholds change.

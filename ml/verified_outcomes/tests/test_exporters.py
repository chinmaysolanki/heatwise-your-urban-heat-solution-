from __future__ import annotations

from pathlib import Path

from verified_outcomes.exporters.export_installer_performance import run as run_perf
from verified_outcomes.exporters.export_verified_training_labels import run as run_labels


def test_export_labels_creates_csv(tmp_path: Path) -> None:
    bundle = {
        "verified_installs": [
            {
                "id": "vi1",
                "installJobId": "j1",
                "projectId": "p1",
                "installerId": "i1",
                "matchesRecommendedCandidate": False,
                "mismatchReasonCodesJson": '["species_unavailable"]',
                "installedSolutionType": "green_roof",
                "installedAreaSqft": 120,
                "installerConfidenceScore": 0.85,
            },
        ],
        "outcome_verifications": [
            {
                "id": "ov1",
                "verifiedInstallId": "vi1",
                "projectId": "p1",
                "verificationConfidenceTier": "high",
                "measuredTempChangeC": -1.0,
                "userSatisfactionScore": 4.0,
                "plantSurvivalRate90d": 0.9,
            },
        ],
        "install_jobs": [{"id": "j1", "jobStatus": "completed", "sourceQuoteId": "q1", "finalCostInr": 100_000}],
        "quotes": [{"id": "q1", "quoteAmountInr": 100_000}],
    }
    run_labels(bundle, tmp_path)
    assert (tmp_path / "verified_labels.csv").is_file()
    text = (tmp_path / "verified_labels.csv").read_text(encoding="utf-8")
    assert "verified_install_match_label" in text


def test_export_perf(tmp_path: Path) -> None:
    bundle = {
        "installer_profiles": [{"id": "i1", "serviceRegionsJson": "[]"}],
        "assignments": [{"installerId": "i1", "assignmentStatus": "invited"}],
        "quotes": [{"installerId": "i1", "quoteStatus": "submitted"}],
        "install_jobs": [{"installerId": "i1", "jobStatus": "completed"}],
        "verified_installs": [{"id": "v1", "installerId": "i1", "matchesRecommendedCandidate": True}],
        "outcome_verifications": [{"verifiedInstallId": "v1", "userSatisfactionScore": 4.0}],
    }
    run_perf(bundle, tmp_path)
    assert (tmp_path / "installer_job_metrics.csv").is_file()

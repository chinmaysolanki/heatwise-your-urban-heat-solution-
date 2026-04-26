#!/usr/bin/env python3
"""
HeatWise offline retraining entrypoint: train → evaluate → register → optional promote.
Run from ``heatwise/ml``: ``python retraining/run_retraining.py ...``
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from string import Template
from typing import Any

import numpy as np
import pandas as pd

ML_ROOT = Path(__file__).resolve().parents[1]
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from retraining import __version__ as RETRAINING_PKG_VERSION
from retraining.data.feature_builder import build_pointwise_features
from retraining.data.load_hybrid_dataset import load_hybrid_snapshot, snapshot_source_mix
from retraining.data.split_manager import SourceFilter, filter_by_source, filter_pairs_by_train_groups, split_by_group
from retraining.data.target_builder import (
    extract_y,
    resolve_feasibility_target,
    resolve_heat_target,
    resolve_ranking_listwise_target,
    source_weight_series,
)
from retraining.evaluation.compare_to_baseline import load_metrics, summarize_comparison
from retraining.evaluation.compare_to_registry_model import latest_metrics_for_task
from retraining.evaluation.evaluate_feasibility import evaluate_feasibility_split
from retraining.evaluation.evaluate_heat_score import evaluate_heat_score_split
from retraining.governance.promotion_gates import PromotionResult, evaluate_gates
from retraining.packaging.export_inference_bundle import export_inference_bundle
from retraining.pipelines.train_feasibility import train_feasibility
from retraining.pipelines.train_heat_score import train_heat_score
from retraining.pipelines.train_ranker import train_ranker
from retraining.registry.artifact_store import ensure_run_dir, save_sklearn_pipeline, write_json
from retraining.registry.model_registry import ModelRegistry, RegistryEntry
from retraining.registry.versioning import next_version


def _ensure_candidate_id(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "candidate_id" not in out.columns and "candidate_key" in out.columns:
        out["candidate_id"] = out["candidate_key"].astype(str)
    return out


def _render_report(template_path: Path, mapping: dict[str, Any]) -> str:
    t = Template(template_path.read_text(encoding="utf-8"))
    return t.safe_substitute(mapping)


def _training_code_version() -> str:
    return os.environ.get("GIT_SHA", os.environ.get("HEATWISE_TRAINING_CODE_VERSION", RETRAINING_PKG_VERSION))


def _run_regression_task(
    task: str,
    train: pd.DataFrame,
    val: pd.DataFrame,
    test: pd.DataFrame,
    species_csv: Path | None,
    use_weights: bool,
) -> tuple[Any, dict[str, Any], str, Any]:
    if task == "feasibility":
        tres = resolve_feasibility_target(train)
        trainer = train_feasibility
    else:
        tres = resolve_heat_target(train)
        trainer = train_heat_score

    y_tr, m_tr = extract_y(train, tres)
    y_va, m_va = extract_y(val, tres)
    y_te, m_te = extract_y(test, tres)

    X_tr, man = build_pointwise_features(train.loc[m_tr].reset_index(drop=True), task, species_csv, tres.column)
    X_va, _ = build_pointwise_features(val.loc[m_va].reset_index(drop=True), task, species_csv, tres.column)
    X_te, _ = build_pointwise_features(test.loc[m_te].reset_index(drop=True), task, species_csv, tres.column)

    sw_tr = source_weight_series(train.loc[m_tr].reset_index(drop=True), use_weights)
    pipe, metrics = trainer(
        X_tr,
        y_tr,
        X_va,
        y_va,
        X_te,
        y_te,
        sample_weight=sw_tr,
        hyperparams=None,
    )

    if task == "feasibility":
        metrics["val_extended"] = evaluate_feasibility_split(
            y_va,
            pipe.predict(X_va),
        )
        metrics["test_extended"] = evaluate_feasibility_split(
            y_te,
            pipe.predict(X_te),
        )
    else:
        metrics["val_extended"] = evaluate_heat_score_split(
            val.loc[m_va].reset_index(drop=True),
            tres.column,
            pipe.predict(X_va),
        )
        metrics["test_extended"] = evaluate_heat_score_split(
            test.loc[m_te].reset_index(drop=True),
            tres.column,
            pipe.predict(X_te),
        )

    man.row_counts.update({"train": int(len(X_tr)), "val": int(len(X_va)), "test": int(len(X_te))})
    return pipe, metrics, tres.column, man


def _run_ranking_task(
    train: pd.DataFrame,
    val: pd.DataFrame,
    test: pd.DataFrame,
    ptr: pd.DataFrame,
    pva: pd.DataFrame,
    pte: pd.DataFrame,
    species_csv: Path | None,
    use_weights: bool,
) -> tuple[Any, dict[str, Any] | None, Any, str, Any]:
    tres = resolve_ranking_listwise_target(train)
    y_tr, m_tr = extract_y(train, tres)
    y_va, m_va = extract_y(val, tres)
    y_te, m_te = extract_y(test, tres)

    X_tr, man = build_pointwise_features(train.loc[m_tr].reset_index(drop=True), "ranking", species_csv, tres.column)
    X_va, _ = build_pointwise_features(val.loc[m_va].reset_index(drop=True), "ranking", species_csv, tres.column)
    X_te, _ = build_pointwise_features(test.loc[m_te].reset_index(drop=True), "ranking", species_csv, tres.column)

    sw_tr = source_weight_series(train.loc[m_tr].reset_index(drop=True), use_weights)

    metrics, pair_pipe, listwise_pipe = train_ranker(
        train.loc[m_tr].reset_index(drop=True),
        val.loc[m_va].reset_index(drop=True),
        test.loc[m_te].reset_index(drop=True),
        ptr,
        pva,
        pte,
        X_tr,
        y_tr,
        X_va,
        y_va,
        X_te,
        y_te,
        species_csv,
        sample_weight=sw_tr,
        hyperparams=None,
    )

    man.row_counts.update({"train": int(len(X_tr)), "val": int(len(X_va)), "test": int(len(X_te))})
    return listwise_pipe, pair_pipe, metrics, tres.column, man


def run(
    *,
    task: str,
    dataset_path: Path,
    registry_dir: Path,
    output_dir: Path,
    experiment_name: str,
    train_snapshot_id: str | None,
    candidate_model_type: str,
    promote_if_passed: bool,
    notes: str,
    source_filter: SourceFilter,
    species_csv: Path | None,
    baseline_metrics_path: Path | None,
    use_sample_weights: bool,
    seed: int,
) -> dict[str, Any]:
    out: dict[str, Any] = {"tasks": []}
    snap = load_hybrid_snapshot(dataset_path, train_snapshot_id)
    pw = _ensure_candidate_id(snap.pointwise)
    pw_f = filter_by_source(pw, source_filter)
    if pw_f.empty:
        raise ValueError("No rows after source filter")

    split_pack = split_by_group(pw_f, seed=seed)
    ptr, pva, pte = filter_pairs_by_train_groups(snap.pairs, split_pack)

    summary: dict[str, Any] = {
        "snapshot_id": snap.snapshot_id,
        "n_train": len(split_pack.train),
        "n_val": len(split_pack.val),
        "n_test": len(split_pack.test),
        "group_col": split_pack.group_col,
        "source_mix_train": snapshot_source_mix(split_pack.train),
    }

    tasks = (
        ["feasibility", "heat_score", "ranking"]
        if task == "all"
        else [task]
    )

    reg = ModelRegistry(registry_dir)
    tpl_train = ML_ROOT / "retraining" / "evaluation" / "reports" / "training_report_template.md"
    tpl_promo = ML_ROOT / "retraining" / "evaluation" / "reports" / "promotion_report_template.md"

    for t in tasks:
        run_dir = Path(output_dir) / experiment_name / t
        run_dir.mkdir(parents=True, exist_ok=True)
        version = next_version(
            "feasibility" if t == "feasibility" else ("heat_score" if t == "heat_score" else "ranking"),
            registry_dir,
        )
        model_id = f"{version}_{experiment_name[:24]}".replace(" ", "_")

        art_dir = ensure_run_dir(registry_dir, model_id)

        if t in ("feasibility", "heat_score"):
            pipe, metrics, target_col, man = _run_regression_task(
                t,
                split_pack.train,
                split_pack.val,
                split_pack.test,
                species_csv,
                use_sample_weights,
            )
            save_sklearn_pipeline(pipe, art_dir / "model.joblib")
            candidate_metrics_flat = metrics
        else:
            listwise_pipe, pair_pipe, metrics, target_col, man = _run_ranking_task(
                split_pack.train,
                split_pack.val,
                split_pack.test,
                ptr,
                pva,
                pte,
                species_csv,
                use_sample_weights,
            )
            save_sklearn_pipeline(listwise_pipe, art_dir / "model.joblib")
            if pair_pipe is not None:
                save_sklearn_pipeline(pair_pipe, art_dir / "model_pairwise.joblib")
            candidate_metrics_flat = metrics

        man_path = art_dir / "feature_manifest.json"
        man.write(man_path)
        metrics_path = art_dir / "metrics.json"
        write_json(metrics_path, metrics)

        artifact_paths = {
            "model.joblib": str((art_dir / "model.joblib").resolve()),
            "feature_manifest.json": str(man_path.resolve()),
            "metrics.json": str(metrics_path.resolve()),
        }
        if (art_dir / "model_pairwise.joblib").is_file():
            artifact_paths["model_pairwise.joblib"] = str((art_dir / "model_pairwise.joblib").resolve())

        train_report = _render_report(
            tpl_train,
            {
                "experiment_name": experiment_name,
                "task": t,
                "training_snapshot_id": snap.snapshot_id,
                "candidate_model_type": candidate_model_type,
                "training_code_version": _training_code_version(),
                "notes": notes or "",
                "dataset_path": str(dataset_path),
                "n_train": str(summary["n_train"]),
                "n_val": str(summary["n_val"]),
                "n_test": str(summary["n_test"]),
                "group_col": split_pack.group_col,
                "source_filter": source_filter,
                "source_mix_train_json": json.dumps(summary["source_mix_train"], indent=2),
                "target_column": target_col,
                "n_features": str(len(man.feature_names)),
                "dropped_features": ", ".join(man.dropped_columns[:40]) + ("..." if len(man.dropped_columns) > 40 else ""),
                "estimator_desc": candidate_model_type,
                "hyperparams_json": "{}",
                "metrics_val_json": json.dumps(metrics.get("val") or metrics.get("listwise", {}).get("val", {}), indent=2),
                "metrics_test_json": json.dumps(metrics.get("test") or metrics.get("listwise", {}).get("test", {}), indent=2),
                "extended_metrics_json": json.dumps(
                    {k: v for k, v in metrics.items() if k.endswith("_extended")},
                    indent=2,
                ),
                "path_model": artifact_paths["model.joblib"],
                "path_manifest": artifact_paths["feature_manifest.json"],
                "path_metrics": artifact_paths["metrics.json"],
                "error_analysis": "See extended metrics; v1 template — expand with residual plots in later revision.",
            },
        )
        (run_dir / "training_report.md").write_text(train_report, encoding="utf-8")

        baseline_m = load_metrics(baseline_metrics_path) if baseline_metrics_path and baseline_metrics_path.is_file() else None
        prod_m = latest_metrics_for_task(registry_dir, t, "production")

        comp_b = summarize_comparison(t, metrics, baseline_m) if baseline_m else {}
        comp_p: dict[str, Any] = {}
        if prod_m:
            comp_p = summarize_comparison(t, metrics, prod_m)

        gate_result, gate_reasons = evaluate_gates(
            "heat_score" if t == "heat_score" else t,
            metrics,
            baseline_m,
            prod_m,
            source_mix=summary["source_mix_train"],
            artifact_paths=artifact_paths,
        )

        promo_text = {
            PromotionResult.PASS: "Eligible for production promotion (subject to human approval).",
            PromotionResult.PASS_TO_STAGING_ONLY: "Promote to staging only until post-install volume threshold met.",
            PromotionResult.REJECT: "Do not promote; address gate failures.",
        }[gate_result]

        promo_report = _render_report(
            tpl_promo,
            {
                "model_id": model_id,
                "candidate_version": version,
                "experiment_name": experiment_name,
                "baseline_ref": str(baseline_metrics_path) if baseline_metrics_path else "none",
                "production_ref": "latest production" if prod_m else "none",
                "candidate_val_metrics_json": json.dumps(metrics.get("val") or metrics.get("listwise", {}).get("val", {}), indent=2),
                "baseline_delta_json": json.dumps(comp_b, indent=2),
                "production_delta_json": json.dumps(comp_p, indent=2),
                "promotion_result": gate_result.value,
                "gate_reasons": "\n".join(f"- {r}" for r in gate_reasons) or "- (none)",
                "recommendation_text": promo_text,
                "risk_notes": "Review subgroup metrics and live cohort coverage before production.",
            },
        )
        (run_dir / "promotion_report.md").write_text(promo_report, encoding="utf-8")

        entry = RegistryEntry(
            model_id=model_id,
            model_name=f"heatwise_{t}",
            task="heat_score" if t == "heat_score" else t,
            version=version,
            status="candidate",
            trained_at=datetime.now(timezone.utc).isoformat(),
            training_snapshot_id=snap.snapshot_id,
            data_sources_used=[source_filter],
            source_mix_summary=summary["source_mix_train"],
            feature_manifest_path=str(man_path.resolve()),
            metrics_summary_path=str(metrics_path.resolve()),
            hyperparams={},
            training_code_version=_training_code_version(),
            artifact_paths=artifact_paths,
            inference_manifest_path=None,
            notes=notes,
            candidate_model_type=candidate_model_type,
            experiment_name=experiment_name,
        )
        reg.append(entry)

        bundle_dir = art_dir / "inference_bundle"
        inf_manifest = export_inference_bundle(
            model_joblib_src=art_dir / "model.joblib",
            feature_manifest_src=man_path,
            metrics_src=metrics_path,
            out_dir=bundle_dir,
            model_id=model_id,
            task=entry.task,
            model_version=version,
            training_snapshot_id=snap.snapshot_id,
            trained_at=entry.trained_at,
        )

        if promote_if_passed and gate_result != PromotionResult.REJECT:
            new_status = "staging" if gate_result == PromotionResult.PASS_TO_STAGING_ONLY else "production"
            if new_status == "production":
                reg.retire_production(entry.task)
            reg.update_status(
                model_id,
                new_status,
                promoted_at=datetime.now(timezone.utc).isoformat(),
                inference_manifest_path=str(inf_manifest.resolve()),
            )

        out["tasks"].append(
            {
                "task": t,
                "model_id": model_id,
                "version": version,
                "metrics_path": str(metrics_path),
                "gate": gate_result.value,
                "promotion_report": str((run_dir / "promotion_report.md").resolve()),
            },
        )

    write_json(Path(output_dir) / experiment_name / "run_summary.json", out)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="HeatWise offline retraining pipeline")
    ap.add_argument("--task", choices=["feasibility", "heat_score", "ranking", "all"], required=True)
    ap.add_argument("--dataset-path", type=Path, required=True)
    ap.add_argument("--registry-dir", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--experiment-name", type=str, default="exp")
    ap.add_argument("--train-snapshot-id", type=str, default=None)
    ap.add_argument("--candidate-model-type", type=str, default="sklearn_hgbr_v1")
    ap.add_argument("--promote-if-passed", action="store_true")
    ap.add_argument("--notes", type=str, default="")
    ap.add_argument(
        "--source-filter",
        type=str,
        default="all",
        choices=["all", "synthetic", "live_implicit", "live_explicit", "post_install_validated"],
    )
    ap.add_argument("--species-csv", type=Path, default=None)
    ap.add_argument("--baseline-metrics", type=Path, default=None)
    ap.add_argument("--use-sample-weights", action="store_true")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    run(
        task=args.task,
        dataset_path=args.dataset_path,
        registry_dir=args.registry_dir,
        output_dir=args.output_dir,
        experiment_name=args.experiment_name,
        train_snapshot_id=args.train_snapshot_id,
        candidate_model_type=args.candidate_model_type,
        promote_if_passed=args.promote_if_passed,
        notes=args.notes,
        source_filter=args.source_filter,  # type: ignore[arg-type]
        species_csv=args.species_csv,
        baseline_metrics_path=args.baseline_metrics,
        use_sample_weights=args.use_sample_weights,
        seed=args.seed,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

from __future__ import annotations

from typing import Any


def validate_remeasurement_row(row: dict[str, Any]) -> tuple[bool, list[str]]:
    errs: list[str] = []

    def rng(name: str, v: Any, lo: float, hi: float) -> None:
        if v is None:
            return
        try:
            x = float(v)
        except (TypeError, ValueError):
            errs.append(f"{name}_not_numeric")
            return
        if x < lo or x > hi:
            errs.append(f"{name}_out_of_range")

    rng("plant_survival_rate", row.get("plant_survival_rate") or row.get("plantSurvivalRate"), 0, 1)
    rng("maintenance_adherence_score", row.get("maintenance_adherence_score") or row.get("maintenanceAdherenceScore"), 0, 1)
    rng("heat_mitigation_stability_score", row.get("heat_mitigation_stability_score") or row.get("heatMitigationStabilityScore"), 0, 1)
    rng("user_satisfaction_score", row.get("user_satisfaction_score") or row.get("userSatisfactionScore"), 0, 5)

    st = row.get("surface_temp_delta_c") if row.get("surface_temp_delta_c") is not None else row.get("surfaceTempDeltaC")
    rng("surface_temp_delta_c", st, -25, 25)

    wl = str(row.get("window_label") or row.get("windowLabel") or "")
    if not wl:
        errs.append("window_label_required")
    elif wl != "ad_hoc" and (not wl.endswith("d") or not wl[:-1].isdigit()):
        errs.append("window_label_format")

    return len(errs) == 0, errs

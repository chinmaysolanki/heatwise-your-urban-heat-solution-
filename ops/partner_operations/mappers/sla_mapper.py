from __future__ import annotations

import json
from typing import Any


def map_sla_metric_row(doc: dict[str, Any]) -> dict[str, Any]:
    meta = doc.get("metadata") if isinstance(doc.get("metadata"), dict) else {}
    return {
        "installer_id": doc.get("installer_id"),
        "window_start": doc.get("window_start"),
        "window_end": doc.get("window_end"),
        "response_time_ms_p50": doc.get("response_time_ms_p50"),
        "quote_turnaround_hours_p50": doc.get("quote_turnaround_hours_p50"),
        "site_visit_completion_rate": doc.get("site_visit_completion_rate"),
        "install_start_delay_days_p50": doc.get("install_start_delay_days_p50"),
        "verification_delay_days_p50": doc.get("verification_delay_days_p50"),
        "job_sample_size": doc.get("job_sample_size"),
        "metadata_json": json.dumps(meta, sort_keys=True) if meta else "",
    }

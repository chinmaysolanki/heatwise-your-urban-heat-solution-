import type { AdminExportEnvelope } from "@/lib/adminAnalyticsTypes";
import type { AdminDateWindow } from "@/lib/services/adminAnalyticsService";

export function wrapAdminExport<T>(data: T, window?: AdminDateWindow): AdminExportEnvelope<T> {
  return {
    schema_version: "admin_metrics.v1",
    generated_at: new Date().toISOString(),
    export_ready: true,
    window: window
      ? {
          start: window.start.toISOString(),
          end: window.end.toISOString(),
        }
      : undefined,
    data,
  };
}

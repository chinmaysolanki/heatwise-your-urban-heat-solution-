import { db } from "@/lib/db";
import type { StructuredError } from "@/lib/recommendationTelemetryTypes";
import { validationError } from "@/lib/recommendationTelemetryValidation";

import type { InstallerSearchFilters } from "@/lib/services/installerNetworkService";
import { profileMatchesFilters } from "@/lib/services/installerNetworkService";

export async function assignInstallersToQuoteRequest(
  quoteRequestId: string,
  installerIds: string[],
  matchContext: InstallerSearchFilters,
): Promise<{ ok: true } | { ok: false; error: StructuredError }> {
  const qr = await db.installerQuoteRequest.findUnique({ where: { id: quoteRequestId } });
  if (!qr) return { ok: false, error: validationError("NOT_FOUND", "quote_request not found") };

  const unique = [...new Set(installerIds.filter(Boolean))];
  if (!unique.length) {
    return { ok: false, error: validationError("INVALID_BODY", "installerIds required") };
  }

  const installers = await db.installerProfile.findMany({ where: { id: { in: unique } } });
  if (installers.length !== unique.length) {
    return { ok: false, error: validationError("INSTALLER_NOT_FOUND", "one or more installer ids invalid") };
  }

  for (const p of installers) {
    if (!profileMatchesFilters(p, matchContext)) {
      return {
        ok: false,
        error: validationError("CAPABILITY_MISMATCH", "installer does not support this job context", {
          installerId: p.id,
        }),
      };
    }
  }

  await db.$transaction(
    unique.map((installerId) =>
      db.installerQuoteAssignment.upsert({
        where: {
          quoteRequestId_installerId: { quoteRequestId, installerId },
        },
        create: {
          quoteRequestId,
          installerId,
          assignmentStatus: "invited",
        },
        update: { assignmentStatus: "invited", declinedAt: null, rejectionReasonCodesJson: null },
      }),
    ),
  );

  await db.installerQuoteRequest.update({
    where: { id: quoteRequestId },
    data: { requestStatus: "assigned" },
  });

  return { ok: true };
}

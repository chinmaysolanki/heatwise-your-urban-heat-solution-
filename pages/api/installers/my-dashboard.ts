/**
 * GET /api/installers/my-dashboard
 * Installer-portal–authed endpoint. Returns the authenticated installer's
 * pending quote assignments, active jobs, and recent completed jobs.
 */
import type { NextApiRequest, NextApiResponse } from "next";

import { db } from "@/lib/db";
import { resolveInstallerPortalCredentials } from "@/lib/installerPortalAuth";

function safeJson(s: string | null | undefined): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "GET only" });
  }

  const cred = resolveInstallerPortalCredentials(req);
  if (!cred) return res.status(401).json({ error: "Installer portal credentials required" });

  const installerId =
    cred.kind === "per_installer" ? cred.installerId : cred.unverifiedInstallerIdClaim;
  if (!installerId) {
    return res.status(400).json({ error: "x-heatwise-installer-id header required" });
  }

  const installer = await db.installerProfile.findUnique({
    where: { id: installerId },
    select: {
      id: true,
      installerName: true,
      verificationStatus: true,
      activeStatus: true,
      averageRating: true,
      jobsCompletedCount: true,
      serviceRegionsJson: true,
    },
  });
  if (!installer) return res.status(404).json({ error: "Installer not found" });

  const [pendingAssignments, activeJobs, completedJobs] = await Promise.all([
    db.installerQuoteAssignment.findMany({
      where: { installerId, assignmentStatus: "invited" },
      include: { quoteRequest: true },
      orderBy: { assignedAt: "desc" },
      take: 30,
    }),
    db.installerInstallJob.findMany({
      where: { installerId, jobStatus: { in: ["scheduled", "started"] } },
      include: { sourceQuote: true },
      orderBy: { scheduledDate: "asc" },
      take: 20,
    }),
    db.installerInstallJob.findMany({
      where: { installerId, jobStatus: { in: ["completed", "cancelled"] } },
      orderBy: { completedAt: "desc" },
      take: 30,
    }),
  ]);

  return res.status(200).json({
    installer: {
      ...installer,
      serviceRegions: safeJson(installer.serviceRegionsJson),
    },
    pendingAssignments: pendingAssignments.map((a) => ({
      id: a.id,
      assignedAt: a.assignedAt,
      quoteRequestId: a.quoteRequestId,
      quoteRequest: {
        id: a.quoteRequest.id,
        projectId: a.quoteRequest.projectId,
        requestStatus: a.quoteRequest.requestStatus,
        requestedAt: a.quoteRequest.requestedAt,
        userLocationRegion: a.quoteRequest.userLocationRegion,
        notes: a.quoteRequest.notes ?? null,
        projectSnapshot: safeJson(a.quoteRequest.projectSnapshotJson),
        candidateSnapshot: safeJson(a.quoteRequest.candidateSnapshotJson ?? null),
      },
    })),
    activeJobs: activeJobs.map((j) => ({
      id: j.id,
      jobStatus: j.jobStatus,
      projectId: j.projectId,
      scheduledDate: j.scheduledDate,
      startedAt: j.startedAt,
      estimatedCostInr: j.estimatedCostInr,
      finalCostInr: j.finalCostInr,
      jobNotes: j.jobNotes ?? null,
      installPlan: safeJson(j.installPlanJson),
      sourceQuote: j.sourceQuote
        ? {
            quoteAmountInr: j.sourceQuote.quoteAmountInr,
            estimatedTimelineDays: j.sourceQuote.estimatedTimelineDays,
            includedScope: safeJson(j.sourceQuote.includedScopeJson),
            proposedSpecies: safeJson(j.sourceQuote.proposedSpeciesJson ?? null),
            notes: j.sourceQuote.notes ?? null,
          }
        : null,
    })),
    completedJobs: completedJobs.map((j) => ({
      id: j.id,
      jobStatus: j.jobStatus,
      projectId: j.projectId,
      completedAt: j.completedAt,
      cancelledAt: j.cancelledAt,
      finalCostInr: j.finalCostInr,
      estimatedCostInr: j.estimatedCostInr,
    })),
    stats: {
      pendingCount: pendingAssignments.length,
      activeCount: activeJobs.length,
      completedTotal: installer.jobsCompletedCount,
      averageRating: installer.averageRating,
    },
  });
}

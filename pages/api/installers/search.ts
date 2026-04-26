import type { NextApiRequest, NextApiResponse } from "next";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { hasValidOpsToken } from "@/lib/opsAuth";
import { searchInstallers } from "@/lib/services/installerNetworkService";

import { readJsonBody, sendStructuredError } from "./_utils";

/**
 * Discover installers by region / project / solution / budget / area.
 * Auth: logged-in user **or** ``x-heatwise-ops-token`` (see ``lib/opsAuth.ts``).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
  }

  const session = await getServerSession(req, res, authOptions as NextAuthOptions);
  if (!session && !hasValidOpsToken(req)) {
    return sendStructuredError(
      res,
      { code: "UNAUTHORIZED", message: "Session or ops token required" },
      401,
    );
  }

  const q =
    req.method === "GET"
      ? (req.query as Record<string, string | string[] | undefined>)
      : (readJsonBody<Record<string, unknown>>(req.body) ?? {});

  const region = String(
    (typeof q.region === "string" ? q.region : Array.isArray(q.region) ? q.region[0] : q.region) ?? "",
  ).trim();
  if (!region) {
    return sendStructuredError(res, { code: "INVALID_QUERY", message: "region required" }, 400);
  }

  const projectType = q.projectType != null ? String(q.projectType) : undefined;
  const solutionType = q.solutionType != null ? String(q.solutionType) : undefined;
  const budgetBand = q.budgetBand != null ? String(q.budgetBand) : undefined;
  const areaRaw = q.areaSqft ?? q.area_sqft;
  const areaSqft = areaRaw != null ? Number(areaRaw) : undefined;

  const matches = await searchInstallers({
    region,
    projectType,
    solutionType,
    budgetBand,
    areaSqft: Number.isFinite(areaSqft) ? areaSqft : undefined,
  });

  return res.status(200).json({
    installers: matches.map((p) => ({
      installer_id: p.id,
      installer_name: p.installerName,
      service_regions_json: p.serviceRegionsJson,
      supported_project_types_json: p.supportedProjectTypesJson,
      supported_solution_types_json: p.supportedSolutionTypesJson,
      min_job_size_sqft: p.minJobSizeSqft,
      max_job_size_sqft: p.maxJobSizeSqft,
      verification_status: p.verificationStatus,
      jobs_completed_count: p.jobsCompletedCount,
    })),
    count: matches.length,
  });
}

import type { NextApiRequest, NextApiResponse } from "next";
import type { ProjectInput } from "@/models";
import {
  orchestrateLayoutRecommendations,
  toGenerateLayoutHttpResponse,
} from "@/lib/recommendation/orchestrateLayoutRecommendations";

/**
 * POST /api/generate-layout
 * Compatibility wrapper: delegates to shared orchestration used by the canonical recommendation stack.
 * Body: ProjectInput + optional projectId, photoSessionId
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  const method = (req as { method?: string }).method;
  if (method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const body = req.body as unknown;
  if (!body || typeof body !== "object") {
    res.status(400).json({ message: "Request body must be a JSON object (ProjectInput)" });
    return;
  }

  const { projectId, photoSessionId, ...rest } = body as Record<string, unknown>;
  const input = rest as unknown as ProjectInput;

  const required = [
    "spaceType", "widthM", "lengthM", "floorLevel", "sunExposure",
    "windLevel", "waterAccess", "budgetRange", "maintenanceLevel", "primaryGoal",
  ] as const;
  for (const key of required) {
    if (input[key] === undefined) {
      res.status(400).json({
        message: `Missing required field: ${key}`,
      });
      return;
    }
  }

  try {
    const result = await orchestrateLayoutRecommendations({
      input,
      projectId: typeof projectId === "string" ? projectId : null,
      photoSessionId: typeof photoSessionId === "string" ? photoSessionId : null,
      persistLayoutRun: true,
    });
    res.status(200).json(toGenerateLayoutHttpResponse(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline failed";
    res.status(500).json({ message, error: String(err) });
  }
}

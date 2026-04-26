import type { NextApiRequest, NextApiResponse } from "next";

import type { AssignmentPayload } from "@/lib/ml/evaluationTypes";
import { assignForRequest } from "@/lib/services/experimentAssignmentService";
import { readJsonBody, sendStructuredError } from "./_utils";

type AssignmentBody = {
  assignmentKey: string;
  experimentId?: string | null;
  userId?: string | null;
  projectId?: string | null;
  projectType?: string | null;
  climateZone?: string | null;
  cityTier?: string | null;
  internalUser?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "POST only" } });
  }

  const body = readJsonBody<AssignmentBody>(req.body);
  if (!body || typeof body.assignmentKey !== "string" || !body.assignmentKey.trim()) {
    return sendStructuredError(
      res,
      { code: "INVALID_BODY", message: "Expected assignmentKey (non-empty string)" },
      400,
    );
  }

  const payload: AssignmentPayload = assignForRequest({
    assignmentKey: body.assignmentKey.trim(),
    experimentId: body.experimentId,
    userId: body.userId,
    projectId: body.projectId,
    evaluationContext: {
      projectType: body.projectType,
      climateZone: body.climateZone,
      cityTier: body.cityTier,
      internalUser: body.internalUser,
    },
  });

  return res.status(200).json({ assignment: payload });
}

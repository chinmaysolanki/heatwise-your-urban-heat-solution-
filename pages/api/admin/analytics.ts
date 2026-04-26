import type { NextApiRequest, NextApiResponse } from "next";

import { requireAdminSession } from "@/lib/adminAuth";
import { buildAdminAnalytics } from "@/lib/internalAnalytics";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await requireAdminSession(req, res);
  if (!session) return;

  const payload = await buildAdminAnalytics();
  return res.status(200).json(payload);
}


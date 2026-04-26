import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { photoSessionToRestoreResponse } from "@/lib/photoSession/photoSessionRestoreDto";

function mustHaveSessionInProd(session: any, res: NextApiResponse): boolean {
  if (process.env.NODE_ENV === "production" && !session) {
    res.status(401).json({ message: "Unauthorized" });
    return false;
  }
  return true;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const sessionUser = await getServerSession(req, res, authOptions as any);
  if (!mustHaveSessionInProd(sessionUser, res)) return;
  const userId = (sessionUser as any)?.user?.id as string | undefined;

  const { id } = req.query;

  if (typeof id !== "string") {
    res.status(400).json({ message: "Invalid id" });
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const photoSession = await db.photoSession.findUnique({
    where: { id },
    include: {
      environmentSnapshot: true,
      recommendationRuns: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, createdAt: true },
      },
    },
  });
  if (!photoSession) {
    res.status(404).json({ message: "Not found" });
    return;
  }

  // If authenticated, enforce ownership via PhotoSession.userId
  if (userId && photoSession.userId !== userId) {
    res.status(404).json({ message: "Not found" });
    return;
  }

  res.status(200).json(photoSessionToRestoreResponse(photoSession));
}


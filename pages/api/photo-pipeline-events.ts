import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

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
  const session = await getServerSession(req, res, authOptions as any);
  if (!mustHaveSessionInProd(session, res)) return;
  const userId = (session as any)?.user?.id as string | undefined;

  if (req.method === "GET") {
    const { photoSessionId } = req.query;
    if (typeof photoSessionId !== "string" || !photoSessionId) {
      res.status(400).json({ message: "Missing photoSessionId" });
      return;
    }

    // If authenticated, enforce ownership via PhotoSession.userId
    if (userId) {
      const owns = await db.photoSession.findFirst({
        where: { id: photoSessionId, userId },
        select: { id: true },
      });
      if (!owns) {
        res.status(404).json({ message: "Not found" });
        return;
      }
    }

    const events = await db.photoPipelineEvent.findMany({
      where: { photoSessionId },
      orderBy: { createdAt: "asc" },
    });
    res.status(200).json({ events });
    return;
  }

  if (req.method === "POST") {
    const { photoSessionId, action, projectId, payload } = req.body ?? {};
    if (typeof photoSessionId !== "string" || !photoSessionId) {
      res.status(400).json({ message: "Missing photoSessionId" });
      return;
    }
    if (typeof action !== "string" || !action) {
      res.status(400).json({ message: "Missing action" });
      return;
    }

    // If authenticated, enforce ownership via PhotoSession.userId
    if (userId) {
      const owns = await db.photoSession.findFirst({
        where: { id: photoSessionId, userId },
        select: { id: true },
      });
      if (!owns) {
        res.status(404).json({ message: "Not found" });
        return;
      }
    }

    const created = await db.photoPipelineEvent.create({
      data: {
        photoSessionId,
        action,
        userId: userId ?? null,
        projectId: typeof projectId === "string" ? projectId : null,
        payload: payload ? JSON.stringify(payload) : null,
      },
    });
    res.status(201).json({ id: created.id, createdAt: created.createdAt });
    return;
  }

  res.setHeader("Allow", "GET, POST");
  res.status(405).json({ message: "Method Not Allowed" });
}


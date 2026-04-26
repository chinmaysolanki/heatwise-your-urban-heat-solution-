import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoSessionToRestoreResponse } from "@/lib/photoSession/photoSessionRestoreDto";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: "Unauthorized" });

  const { id } = req.query;

  if (req.method === "GET") {
    const project = await db.project.findFirst({
      where: { id, userId: session.user.id },
      include: { analysis: true },
    });
    if (!project) return res.status(404).json({ message: "Not found" });
    const latestPsRow = await db.photoSession.findFirst({
      where: { projectId: id, userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        environmentSnapshot: true,
        recommendationRuns: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, createdAt: true },
        },
      },
    });
    const latestPhotoSession = latestPsRow
      ? photoSessionToRestoreResponse(latestPsRow)
      : null;
    return res.json({ ...project, latestPhotoSession });
  }

  if (req.method === "PATCH") {
    const existing = await db.project.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });
    const project = await db.project.update({
      where: { id },
      data: req.body,
    });
    return res.json(project);
  }

  if (req.method === "DELETE") {
    const existing = await db.project.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ message: "Not found" });
    await db.project.delete({ where: { id } });
    return res.status(204).end();
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}


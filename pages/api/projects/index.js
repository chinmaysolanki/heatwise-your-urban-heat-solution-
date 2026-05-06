import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  // Guest mode: no auth required — return a synthetic project (no DB write)
  if (!session) {
    if (req.method === "POST") {
      const { name, location, surfaceType, primaryGoal, area, obstacles } = req.body ?? {};
      return res.status(201).json({
        id: randomUUID(),
        name: name ?? "Untitled Project",
        location: location ?? "",
        surfaceType: surfaceType ?? "rooftop",
        primaryGoal: primaryGoal ?? "cooling",
        area: Number(area) || 0,
        obstacles: obstacles ?? "",
        status: "Draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    if (req.method === "GET") return res.json([]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  if (req.method === "GET") {
    const projects = await db.project.findMany({
      where: { userId: session.user.id },
      include: { analysis: true },
      orderBy: { createdAt: "desc" },
    });
    return res.json(projects);
  }

  if (req.method === "POST") {
    const { name, location, surfaceType, primaryGoal, area, obstacles, status } = req.body;
    const project = await db.project.create({
      data: {
        name: name ?? "Untitled Project",
        location: location ?? "",
        surfaceType: surfaceType ?? "rooftop",
        primaryGoal: primaryGoal ?? "cooling",
        area: Number(area) || 0,
        obstacles: obstacles ?? "",
        ...(status ? { status } : {}),
        userId: session.user.id,
      },
    });
    return res.status(201).json(project);
  }

  return res.status(405).json({ message: "Method Not Allowed" });
}

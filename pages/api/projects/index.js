import { randomUUID } from "crypto";

export default async function handler(req, res) {
  // Guest mode — no authentication required.
  // Project data lives in the client (photoSession state); we return a UUID so
  // downstream calls have a stable projectId without needing a DB write.

  if (req.method === "GET") {
    return res.json([]);
  }

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

  return res.status(405).json({ message: "Method Not Allowed" });
}

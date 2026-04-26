import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req, res) {
  if (req.method !== "PATCH") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: "Unauthorized" });

  const updated = await db.userSettings.upsert({
    where: { userId: session.user.id },
    update: req.body,
    create: { userId: session.user.id, ...req.body },
  });

  return res.json(updated);
}


import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return Math.min(max, Math.max(min, i));
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = (await getServerSession(req, res, authOptions as any)) as any;
  if (!session) return res.status(401).json({ message: "Unauthorized" });

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const body = req.body ?? {};
  const email = str((body as any).email);
  const city = str((body as any).city);
  const state = str((body as any).state);
  const country = str((body as any).country);
  const age = clampInt((body as any).age, 1, 120);
  const gardeningInterestScore = clampInt((body as any).gardeningInterestScore, 1, 10);

  if (!email || !city || !state || !country || age == null || gardeningInterestScore == null) {
    return res.status(400).json({ message: "Missing or invalid profile fields" });
  }

  try {
    const updated = await db.user.update({
      where: { id: session.user.id },
      data: {
        email,
        city,
        state,
        country,
        age,
        gardeningInterestScore,
        profileCompleted: true,
      },
      select: {
        id: true,
        email: true,
        profileCompleted: true,
        city: true,
        state: true,
        country: true,
        age: true,
        gardeningInterestScore: true,
      },
    });
    return res.status(200).json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update profile";
    return res.status(400).json({ message: msg });
  }
}


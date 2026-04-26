import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ message: "Unauthorized" });

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phoneNumber: true,
      phoneVerified: true,
      profileCompleted: true,
      city: true,
      state: true,
      country: true,
      age: true,
      gardeningInterestScore: true,
      settings: true,
    },
  });

  return res.json(user);
}


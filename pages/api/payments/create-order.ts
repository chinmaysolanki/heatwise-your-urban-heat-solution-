/**
 * POST /api/payments/create-order
 * Creates a Razorpay order for a Green or Pro subscription.
 * Returns { orderId, amount, currency, keyId } for the frontend checkout.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import Razorpay from "razorpay";
import { db } from "@/lib/db";

const PLANS: Record<string, { monthly: number; yearly: number }> = {
  green: { monthly: 49900, yearly: 478800 },  // paise: ₹499 / ₹4788
  pro:   { monthly: 249900, yearly: 2398800 }, // paise: ₹2499 / ₹23988
};

type Body = {
  userId: string;
  plan: "green" | "pro";
  billingCycle: "monthly" | "yearly";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const { userId, plan, billingCycle } = (req.body ?? {}) as Partial<Body>;

  if (!userId || !plan || !billingCycle) {
    return res.status(400).json({ error: "userId, plan, and billingCycle required" });
  }
  if (!PLANS[plan]) {
    return res.status(400).json({ error: "Invalid plan. Use green or pro" });
  }
  if (billingCycle !== "monthly" && billingCycle !== "yearly") {
    return res.status(400).json({ error: "billingCycle must be monthly or yearly" });
  }

  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return res.status(500).json({ error: "Razorpay credentials not configured" });
  }

  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const amountPaise = PLANS[plan][billingCycle];

  const order = await razorpay.orders.create({
    amount: amountPaise,
    currency: "INR",
    receipt: `hw-${userId.slice(-8)}-${Date.now()}`,
    notes: { userId, plan, billingCycle },
  });

  return res.status(200).json({
    orderId: order.id,
    amount: amountPaise,
    currency: "INR",
    keyId,
    plan,
    billingCycle,
  });
}

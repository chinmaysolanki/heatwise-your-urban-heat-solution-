/**
 * POST /api/payments/verify
 * Verifies Razorpay payment signature after checkout success.
 * On valid signature: creates/updates UserSubscription and returns { ok: true }.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { db } from "@/lib/db";

const PLAN_DURATIONS_DAYS: Record<string, number> = {
  monthly: 30,
  yearly: 365,
};

const PLAN_AMOUNTS_INR: Record<string, Record<string, number>> = {
  green: { monthly: 499, yearly: 4788 },
  pro:   { monthly: 2499, yearly: 23988 },
};

type Body = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  userId: string;
  plan: string;
  billingCycle: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    userId,
    plan,
    billingCycle,
  } = (req.body ?? {}) as Partial<Body>;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !userId || !plan || !billingCycle) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Verify HMAC-SHA256 signature
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return res.status(500).json({ error: "Razorpay not configured" });

  const expectedSig = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSig !== razorpay_signature) {
    return res.status(400).json({ error: "Invalid payment signature" });
  }

  // Activate subscription
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + (PLAN_DURATIONS_DAYS[billingCycle] ?? 30));

  await db.userSubscription.upsert({
    where: { userId },
    create: {
      userId,
      plan,
      billingCycle,
      status: "active",
      amountInr: PLAN_AMOUNTS_INR[plan]?.[billingCycle] ?? 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    },
    update: {
      plan,
      billingCycle,
      status: "active",
      amountInr: PLAN_AMOUNTS_INR[plan]?.[billingCycle] ?? 0,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
    },
  });

  return res.status(200).json({ ok: true, plan, expiresAt: periodEnd.toISOString() });
}

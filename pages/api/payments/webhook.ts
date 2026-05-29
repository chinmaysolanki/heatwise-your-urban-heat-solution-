/**
 * POST /api/payments/webhook
 * Handles Razorpay webhook events.
 * Set this URL in Razorpay Dashboard → Settings → Webhooks:
 *   https://heatwise.codes/api/payments/webhook
 *
 * Events handled:
 *   payment.captured  → mark subscription active
 *   payment.failed    → mark subscription expired
 */
import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { db } from "@/lib/db";

export const config = { api: { bodyParser: false } };

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST only" });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const rawBody = await getRawBody(req);

  // Verify webhook signature if secret is configured
  if (webhookSecret) {
    const signature = req.headers["x-razorpay-signature"] as string;
    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    if (signature !== expectedSig) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }
  }

  let event: { event: string; payload: Record<string, unknown> };
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  const payment = (event.payload?.payment as Record<string, unknown>)?.entity as Record<string, unknown> | undefined;
  const notes = payment?.notes as Record<string, string> | undefined;
  const userId = notes?.userId;
  const orderId = payment?.order_id as string | undefined;

  if (event.event === "payment.captured" && userId && orderId) {
    await db.userSubscription.updateMany({
      where: { userId, razorpayOrderId: orderId },
      data: { status: "active" },
    });
  }

  if (event.event === "payment.failed" && userId && orderId) {
    await db.userSubscription.updateMany({
      where: { userId, razorpayOrderId: orderId },
      data: { status: "expired" },
    });
  }

  return res.status(200).json({ received: true });
}

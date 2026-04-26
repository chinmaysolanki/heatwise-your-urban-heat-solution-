import type { NextApiRequest, NextApiResponse } from "next";

import { db } from "@/lib/db";
import { requireOpsOrAdmin } from "@/lib/opsAuth";
import type { CreateDeliveryInput, UpdateDeliveryStatusInput } from "@/lib/integrationTypes";
import { createDeliveryTracking, updateDeliveryStatus } from "@/lib/services/deliveryTrackingService";

import { readJsonBody, sendStructuredError } from "./_utils";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method === "GET") {
    const ok = await requireOpsOrAdmin(req, res);
    if (!ok) return;
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) {
      return sendStructuredError(res, { code: "INVALID_QUERY", message: "id required" }, 400);
    }
    const row = await db.deliveryTracking.findUnique({ where: { id } });
    if (!row) {
      return sendStructuredError(res, { code: "NOT_FOUND", message: "delivery not found" }, 404);
    }
    return res.status(200).json({
      deliveryTrackingId: row.id,
      deliveryType: row.deliveryType,
      channel: row.channel,
      targetRef: row.targetRef,
      deliveryStatus: row.deliveryStatus,
      attemptCount: row.attemptCount,
      correlationId: row.correlationId,
      outboundSyncId: row.outboundSyncId,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: { code: "METHOD_NOT_ALLOWED", message: "GET or POST" } });
  }

  const ok = await requireOpsOrAdmin(req, res);
  if (!ok) return;

  const body = readJsonBody<CreateDeliveryInput & UpdateDeliveryStatusInput & { mode?: string }>(req.body);
  if (!body) {
    return sendStructuredError(res, { code: "INVALID_BODY", message: "JSON body required" }, 400);
  }

  if ("deliveryTrackingId" in body && body.deliveryTrackingId && "deliveryStatus" in body && body.deliveryStatus) {
    const out = await updateDeliveryStatus({
      deliveryTrackingId: body.deliveryTrackingId,
      deliveryStatus: body.deliveryStatus,
      lastStatusDetail:
        body.lastStatusDetail && typeof body.lastStatusDetail === "object"
          ? (body.lastStatusDetail as Record<string, unknown>)
          : undefined,
      incrementAttempt: Boolean((body as { incrementAttempt?: boolean }).incrementAttempt),
    });
    if (!out.ok) {
      const status = out.error.code === "NOT_FOUND" ? 404 : 400;
      return sendStructuredError(res, out.error, status);
    }
    return res.status(200).json({ ok: true });
  }

  const createBody = body as CreateDeliveryInput;
  if (!createBody.deliveryType || !createBody.channel || !createBody.targetRef) {
    return sendStructuredError(
      res,
      {
        code: "INVALID_BODY",
        message: "For create: deliveryType, channel, targetRef required. For update: deliveryTrackingId, deliveryStatus.",
      },
      400,
    );
  }

  const created = await createDeliveryTracking(createBody);
  if (!created.ok) {
    return sendStructuredError(res, created.error, 400);
  }
  return res.status(201).json({ deliveryTrackingId: created.deliveryTrackingId });
}

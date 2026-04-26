/**
 * Full HTTP E2E (recommended): set `HEATWISE_E2E_HTTP=1`, `HEATWISE_E2E_BASE_URL`, session cookie **or**
 * E2E issuer (`HEATWISE_ENABLE_E2E_ISSUER` + secret on server, `HEATWISE_E2E_ISSUER_SECRET` in client).
 *
 * Service-only (no HTTP): omit `HEATWISE_E2E_HTTP` — uses Prisma services for offline DB checks.
 *
 * @see docs/E2E_HTTP_WORKFLOW.md
 */
import { readFile } from "fs/promises";

import { db } from "@/lib/db";
import type { RecommendationGenerateResponse } from "@/lib/ml/recommendationRuntimeTypes";
import { createQuoteRequest } from "@/lib/services/quoteWorkflowService";
import { generateRecommendationsRuntime } from "@/lib/services/mlRecommendationService";
import { createRecommendationSession } from "@/lib/services/recommendationTelemetryService";

function requireEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  if (!v) {
    console.error(`Missing ${name}`);
    process.exit(1);
  }
  return v;
}

async function postJson(
  base: string,
  path: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<unknown> {
  const h = { "Content-Type": "application/json", ...headers };
  const r = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`E2E HTTP ${path} non-JSON (${r.status}): ${text.slice(0, 200)}`);
  }
  if (!r.ok) {
    throw new Error(`E2E HTTP ${path} ${r.status}: ${text.slice(0, 800)}`);
  }
  return json;
}

/** Extract Set-Cookie session value for NextAuth JWT cookie. */
function sessionCookieFromSetCookie(setCookie: string | null, cookieName: string): string | null {
  if (!setCookie) return null;
  const parts = setCookie.split(/,(?=[^;]+=[^;])/);
  for (const p of parts) {
    const s = p.trim();
    if (s.startsWith(`${cookieName}=`)) {
      const val = s.slice(cookieName.length + 1).split(";")[0];
      return `${cookieName}=${val}`;
    }
  }
  return null;
}

async function mintSessionCookie(base: string): Promise<string> {
  const issuerSecret = (process.env.HEATWISE_E2E_ISSUER_SECRET ?? "").trim();
  const userId = (process.env.HEATWISE_E2E_USER_ID ?? "").trim();
  const email = (process.env.HEATWISE_E2E_EMAIL ?? "").trim();
  if (!issuerSecret || (!userId && !email)) {
    throw new Error(
      "HTTP E2E needs HEATWISE_E2E_ISSUER_SECRET and HEATWISE_E2E_USER_ID or HEATWISE_E2E_EMAIL " +
        "(server must set HEATWISE_ENABLE_E2E_ISSUER=1), or set HEATWISE_E2E_SESSION_COOKIE manually.",
    );
  }
  const r = await fetch(`${base.replace(/\/$/, "")}/api/e2e/issue-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-heatwise-e2e-issuer-secret": issuerSecret,
    },
    body: JSON.stringify(userId ? { userId } : { email }),
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`issue-session failed ${r.status}: ${text.slice(0, 500)}`);
  }
  const issueJson = JSON.parse(text) as { cookieName?: string };
  const setCookie = r.headers.get("set-cookie");
  const cookieName =
    issueJson.cookieName ??
    (process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token");
  const pair = sessionCookieFromSetCookie(setCookie, cookieName);
  if (!pair) {
    throw new Error(`issue-session: no ${cookieName} in Set-Cookie`);
  }
  return pair;
}

async function main(): Promise<void> {
  const projectId = requireEnv("HEATWISE_E2E_PROJECT_ID");
  const userId = (process.env.HEATWISE_E2E_USER_ID ?? "").trim() || null;
  const base = (process.env.HEATWISE_E2E_BASE_URL ?? "").trim();
  const httpStrict = (process.env.HEATWISE_E2E_HTTP ?? "").trim() === "1";
  const extended = (process.env.HEATWISE_E2E_EXTENDED ?? "").trim() === "1";

  let sessionCookie = (process.env.HEATWISE_E2E_SESSION_COOKIE ?? "").trim() || null;

  if (httpStrict && !base) {
    console.error("HEATWISE_E2E_HTTP=1 requires HEATWISE_E2E_BASE_URL");
    process.exit(1);
  }

  if (httpStrict && !sessionCookie) {
    sessionCookie = await mintSessionCookie(base);
    console.error("[e2e] minted session cookie via /api/e2e/issue-session");
  }

  const project: Record<string, unknown> = { id: projectId, budget_inr: 100_000 };
  const environment: Record<string, unknown> = { city: "Bengaluru", region: "KA" };
  const preferences: Record<string, unknown> = { budget_inr: 100_000 };
  const genReq = {
    project,
    environment,
    preferences,
    projectId,
    userId,
    maxCandidates: 3,
    skipGeoEnrichment: true,
    skipSupplyConstraints: true,
    skipPricingEnrichment: true,
  };

  const hdrEmpty: Record<string, string> = {};
  const hdrUser: Record<string, string> = sessionCookie ? { Cookie: sessionCookie } : {};

  let out: RecommendationGenerateResponse;
  if (base && httpStrict) {
    out = (await postJson(base, "/api/recommendations/generate", genReq, hdrEmpty)) as RecommendationGenerateResponse;
  } else if (base && !httpStrict) {
    out = (await postJson(base, "/api/recommendations/generate", genReq, hdrEmpty)) as RecommendationGenerateResponse;
  } else {
    out = await generateRecommendationsRuntime(
      genReq as Parameters<typeof generateRecommendationsRuntime>[0],
    );
  }

  if (!out.candidates?.length) {
    console.error("E2E fail: no candidates from generate");
    process.exit(1);
  }

  const modelVersion =
    [out.telemetryMeta.modelVersionFeasibility, out.telemetryMeta.modelVersionHeat, out.telemetryMeta.modelVersionRanking]
      .filter(Boolean)
      .join("/") || "rules_or_unversioned";

  const genSrc =
    typeof out.telemetryMeta.generatorSource === "string" && out.telemetryMeta.generatorSource.trim()
      ? out.telemetryMeta.generatorSource.trim()
      : out.mode === "rules_only"
        ? "live_rules"
        : "ml_ranker";

  const sessionIn = {
    projectId,
    userId,
    modelVersion,
    rulesVersion: out.telemetryMeta.rulesVersion,
    generatorSource: genSrc,
    projectSnapshot: project,
    environmentSnapshot: environment,
    preferenceSnapshot: preferences,
    totalCandidates: out.candidates.length,
    latencyMs: 1,
    idempotencyKey: `e2e-session-${projectId}-${Date.now()}`,
    candidates: out.candidates.map((c) => ({
      candidateRank: c.rank,
      candidateScore: c.scores.blended,
      candidateSource: genSrc,
      candidatePayload: c.candidatePayload,
    })),
  };

  let recommendationSessionId: string;
  let candidateSnapshotIds: string[];

  if (base && httpStrict) {
    const sessJson = (await postJson(base, "/api/recommendations/create-session", sessionIn, hdrEmpty)) as {
      recommendationSessionId: string;
      candidateSnapshotIds: string[];
      idempotency?: { replayed: boolean; scope: string };
    };
    recommendationSessionId = sessJson.recommendationSessionId;
    candidateSnapshotIds = sessJson.candidateSnapshotIds;
  } else if (base && !httpStrict) {
    const sessJson = (await postJson(base, "/api/recommendations/create-session", sessionIn, hdrEmpty)) as {
      recommendationSessionId: string;
      candidateSnapshotIds: string[];
    };
    recommendationSessionId = sessJson.recommendationSessionId;
    candidateSnapshotIds = sessJson.candidateSnapshotIds;
  } else {
    const sess = await createRecommendationSession(sessionIn);
    if (!sess.ok) {
      console.error("create-session failed:", sess.error);
      process.exit(1);
    }
    recommendationSessionId = sess.data.recommendationSessionId;
    candidateSnapshotIds = sess.data.candidateSnapshotIds;
  }

  const snapId = candidateSnapshotIds[0];
  const quoteInput = {
    projectId,
    userId,
    recommendationSessionId,
    selectedCandidateSnapshotId: snapId,
    userLocationRegion: "IN-KA",
    projectSnapshot: project,
    candidateSnapshot: out.candidates[0]?.candidatePayload ?? {},
    idempotencyKey: `e2e-quote-${recommendationSessionId}`,
  };

  let quoteRequestId: string;

  if (httpStrict) {
    if (!sessionCookie) {
      console.error("HTTP strict mode requires session cookie");
      process.exit(1);
    }
    const qj = (await postJson(base, "/api/installers/request-quote", quoteInput, hdrUser)) as {
      quoteRequestId: string;
      idempotency?: { replayed: boolean; scope: string };
    };
    quoteRequestId = qj.quoteRequestId;
  } else if (base && sessionCookie) {
    const qj = (await postJson(base, "/api/installers/request-quote", quoteInput, hdrUser)) as {
      quoteRequestId: string;
    };
    quoteRequestId = qj.quoteRequestId;
  } else {
    if (base && !sessionCookie) {
      console.warn("[e2e] quote via service layer (set HEATWISE_E2E_HTTP=1 + issuer for full HTTP).");
    }
    const quote = await createQuoteRequest(quoteInput);
    if (!quote.ok) {
      console.error("quote request failed:", quote.error);
      process.exit(1);
    }
    quoteRequestId = quote.quoteRequestId;
  }

  const report: Record<string, unknown> = {
    ok: true,
    mode: httpStrict ? "http_strict" : base ? "http_partial" : "service",
    recommendationSessionId,
    candidateSnapshotIds,
    quoteRequestId,
    generateMode: out.mode,
    enrichmentStatus: out.enrichmentStatus ?? null,
    enrichmentPartialSuccess: out.enrichmentPartialSuccess ?? null,
  };

  if (extended) {
    const ops = (process.env.HEATWISE_E2E_OPS_TOKEN ?? "").trim();
    const installerId = (process.env.HEATWISE_E2E_INSTALLER_ID ?? "").trim();
    if (!ops || !installerId) {
      console.error("HEATWISE_E2E_EXTENDED=1 requires HEATWISE_E2E_OPS_TOKEN and HEATWISE_E2E_INSTALLER_ID");
      process.exit(1);
    }
    if (!httpStrict || !base) {
      console.error("Extended installer chain requires HEATWISE_E2E_HTTP=1 and HEATWISE_E2E_BASE_URL");
      process.exit(1);
    }

    const opsH = { "x-heatwise-ops-token": ops };

    await postJson(
      base,
      "/api/installers/assign",
      {
        quoteRequestId,
        installerIds: [installerId],
        matchContext: { region: "KA" },
      },
      opsH,
    );

    const assignment = await db.installerQuoteAssignment.findFirst({
      where: { quoteRequestId, installerId },
    });
    if (!assignment) {
      console.error("E2E extended: no InstallerQuoteAssignment after assign");
      process.exit(1);
    }

    const quoteOut = (await postJson(
      base,
      "/api/installers/submit-quote",
      {
        idempotencyKey: `e2e-installer-quote-${assignment.id}`,
        quoteRequestId,
        quoteAssignmentId: assignment.id,
        installerId,
        quoteAmountInr: 95000,
        estimatedTimelineDays: 14,
        includedScope: { work: "planting_and_irrigation" },
        excludedScope: null,
      },
      opsH,
    )) as { installerQuoteId: string };

    const acceptOut = (await postJson(
      base,
      "/api/installers/accept-job",
      {
        installerQuoteId: quoteOut.installerQuoteId,
        installPlan: { phases: [{ name: "phase_1", days: 7 }] },
      },
      opsH,
    )) as { installJobId: string };

    report.extended = {
      installerQuoteId: quoteOut.installerQuoteId,
      installJobId: acceptOut.installJobId,
    };

    const verifiedPath = (process.env.HEATWISE_E2E_VERIFIED_JSON ?? "").trim();
    if (verifiedPath) {
      const portalToken = (process.env.HEATWISE_E2E_INSTALLER_PORTAL_TOKEN ?? "").trim();
      const keysJson = (process.env.HEATWISE_E2E_INSTALLER_KEYS_JSON ?? "").trim();
      const rawVerified = await readFile(verifiedPath, "utf8");
      const verifiedBody = JSON.parse(rawVerified) as Record<string, unknown>;
      verifiedBody.installJobId = acceptOut.installJobId;
      const instHeaders: Record<string, string> = {};
      if (keysJson) {
        const map = JSON.parse(keysJson) as Record<string, string>;
        const sec = map[installerId];
        if (!sec) {
          console.error("HEATWISE_E2E_INSTALLER_KEYS_JSON missing secret for HEATWISE_E2E_INSTALLER_ID");
          process.exit(1);
        }
        instHeaders["x-heatwise-installer-id"] = installerId;
        instHeaders["x-heatwise-installer-token"] = sec;
      } else if (portalToken) {
        instHeaders["x-heatwise-installer-token"] = portalToken;
      } else {
        console.error("Verified step needs HEATWISE_E2E_INSTALLER_KEYS_JSON or HEATWISE_E2E_INSTALLER_PORTAL_TOKEN");
        process.exit(1);
      }
      const vOut = (await postJson(
        base,
        "/api/installers/submit-verified-install",
        verifiedBody,
        instHeaders,
      )) as { verifiedInstallId: string };
      (report.extended as Record<string, unknown>).verifiedInstallId = vOut.verifiedInstallId;
    }
  }

  const qr = await db.installerQuoteRequest.findUnique({
    where: { id: quoteRequestId },
    select: {
      id: true,
      projectId: true,
      recommendationSessionId: true,
      selectedCandidateSnapshotId: true,
    },
  });
  if (!qr || qr.projectId !== projectId) {
    console.error("E2E fail: quote row missing or project mismatch");
    process.exit(1);
  }
  if (qr.recommendationSessionId !== recommendationSessionId) {
    console.error("E2E fail: quote.session FK mismatch");
    process.exit(1);
  }
  if (qr.selectedCandidateSnapshotId !== snapId) {
    console.error("E2E fail: quote.snapshot FK mismatch");
    process.exit(1);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Invoke POST /api/recommendations/generate handler in-process (no HTTP server).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { RecommendationGenerateRequest } from "@/lib/ml/recommendationRuntimeTypes";

export type GenerateApiResult = {
  statusCode: number;
  body: unknown;
};

/**
 * Minimal Next response capture supporting status().json() chaining.
 */
export function createMockResponse(): NextApiResponse & {
  getCaptured: () => { statusCode: number; body: unknown };
} {
  let statusCode = 200;
  let body: unknown;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    setHeader(_name: string, _value: string | number | string[]) {
      return res;
    },
    end(_cb?: () => void) {
      return res;
    },
    getCaptured: () => ({ statusCode, body }),
  };

  return res as unknown as NextApiResponse & { getCaptured: () => { statusCode: number; body: unknown } };
}

export function createPostRequest(
  jsonBody: RecommendationGenerateRequest,
  query: Record<string, string | string[] | undefined> = {},
): NextApiRequest {
  return {
    method: "POST",
    body: jsonBody,
    query,
    headers: {},
    url: "/api/recommendations/generate",
  } as unknown as NextApiRequest;
}

/**
 * Executable that exits 1 immediately (no stdout) so ``spawn(py, ['-m','serving'])`` fails → Node fallback.
 */
export function createFailingPythonStub(): { executablePath: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hw-failpy-"));
  const exe =
    process.platform === "win32" ? path.join(dir, "failpy.bat") : path.join(dir, "failpy");
  if (process.platform === "win32") {
    fs.writeFileSync(exe, "@echo off\r\nexit /b 1\r\n");
  } else {
    fs.writeFileSync(exe, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    try {
      fs.chmodSync(exe, 0o755);
    } catch {
      /* best-effort */
    }
  }
  return {
    executablePath: exe,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

export async function invokeRecommendationsGenerate(
  req: NextApiRequest,
  res: ReturnType<typeof createMockResponse>,
  generateHandler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>,
): Promise<GenerateApiResult> {
  await generateHandler(req, res);
  const { statusCode, body } = res.getCaptured();
  return { statusCode, body };
}

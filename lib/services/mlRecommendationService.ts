import { spawn } from "child_process";
import path from "path";
import fs from "fs";

import type { RecommendationGenerateRequest, RecommendationGenerateResponse } from "@/lib/ml/recommendationRuntimeTypes";
import {
  buildCatalogHybridFallback,
  type CatalogHybridFallbackOpts,
} from "@/lib/recommendation/catalogHybridFallback";

/** Resolve env paths relative to the Next.js app root (`heatwise/`) when not absolute. */
function resolveOptionalPath(raw: string | undefined, baseDir: string): string | undefined {
  if (!raw || !raw.trim()) return undefined;
  const s = raw.trim();
  const abs = path.isAbsolute(s) ? path.normalize(s) : path.resolve(baseDir, s);
  return abs;
}

function mlWorkingDirectory(appRoot: string): string {
  const raw = process.env.HEATWISE_ML_CWD?.trim();
  if (!raw) return path.join(appRoot, "ml");
  return path.isAbsolute(raw) ? path.normalize(raw) : path.resolve(appRoot, raw);
}

function pythonExecutable(): string {
  return process.env.HEATWISE_ML_PYTHON ?? "python3";
}

const USABLE_MODES = new Set<RecommendationGenerateResponse["mode"]>(["full_ml", "rules_only", "partial_ml"]);

/**
 * Mirrors ``ml/serving/serving_response_contract.stdout_payload_is_usable``:
 * at least one non-blocked candidate and minimal shape for the app runtime.
 */
export function pythonRecommendationPayloadUnusableReason(parsed: unknown): string | null {
  if (parsed === null || typeof parsed !== "object") return "unusable_not_object";
  const o = parsed as Record<string, unknown>;
  if (o.heatwiseServingOk === false) return "unusable_heatwise_serving_ok_false";
  const mode = o.mode;
  if (!USABLE_MODES.has(mode as RecommendationGenerateResponse["mode"])) return "unusable_invalid_mode";
  const tm = o.telemetryMeta;
  if (tm === null || typeof tm !== "object") return "unusable_missing_telemetry_meta";
  const cands = o.candidates;
  if (!Array.isArray(cands)) return "unusable_candidates_not_list";
  if (cands.length === 0) return "unusable_empty_candidates";
  const hasOpen = cands.some(
    (c) => c !== null && typeof c === "object" && (c as { blocked?: boolean }).blocked !== true,
  );
  if (!hasOpen) return "unusable_all_candidates_blocked";
  return null;
}

function isUsablePythonRecommendationPayload(parsed: unknown): parsed is RecommendationGenerateResponse {
  return pythonRecommendationPayloadUnusableReason(parsed) === null;
}

/**
 * Runs ``python -m serving`` with JSON on stdin (see ``ml/serving/__main__.py``).
 * Sets ``HEATWISE_REGISTRY_DIR`` in subprocess env when provided on the request or env.
 *
 * Falls back to catalog hybrid when Python exits non-zero, prints unusable JSON, or returns an unusable payload.
 */
export async function generateRecommendationsRuntime(
  body: RecommendationGenerateRequest,
): Promise<RecommendationGenerateResponse> {
  const appRoot = process.cwd();
  const cwd = mlWorkingDirectory(appRoot);

  const registryDir = resolveOptionalPath(body.registryDir ?? process.env.HEATWISE_REGISTRY_DIR, appRoot);
  const speciesCsvPath = resolveOptionalPath(body.speciesCsvPath ?? process.env.HEATWISE_SPECIES_CSV, appRoot);

  const payload = { ...body };
  if (registryDir) payload.registryDir = registryDir;
  if (speciesCsvPath && fs.existsSync(speciesCsvPath)) {
    payload.speciesCsvPath = speciesCsvPath;
  } else {
    delete payload.speciesCsvPath;
  }

  const env = {
    ...process.env,
    ...(registryDir ? { HEATWISE_REGISTRY_DIR: registryDir } : {}),
    ...(speciesCsvPath && fs.existsSync(speciesCsvPath) ? { HEATWISE_SPECIES_CSV: speciesCsvPath } : {}),
  };

  const toFallback = async (partial: CatalogHybridFallbackOpts) =>
    buildCatalogHybridFallback(body, partial);

  return new Promise((resolve) => {
    const py = pythonExecutable();
    const proc = spawn(py, ["-m", "serving"], {
      cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");
    proc.stdout.on("data", (c) => {
      stdout += c;
    });
    proc.stderr.on("data", (c) => {
      stderr += c;
    });

    proc.on("error", () => {
      void (async () => {
        resolve(
          await toFallback({
            stderr: "python_spawn_error",
            fallbackReason: "python_spawn_error",
          }),
        );
      })();
    });

    proc.on("close", (code) => {
      void (async () => {
        const stderrTrim = stderr.trim();
        const stdoutTrim = stdout.trim();

        if (!stdoutTrim) {
          resolve(
            await toFallback({
              stderr: stderrTrim || `python_no_stdout_exit_${code ?? "null"}`,
              pythonExitCode: code,
              fallbackReason: code !== 0 && code !== null ? "python_nonzero_exit" : "python_stdout_empty",
            }),
          );
          return;
        }

        if (code !== 0) {
          resolve(
            await toFallback({
              stderr: stderrTrim || `python_exit_${code}`,
              pythonExitCode: code,
              fallbackReason: "python_nonzero_exit",
            }),
          );
          return;
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(stdoutTrim);
        } catch {
          resolve(
            await toFallback({
              stderr: "node_json_parse_error:invalid_python_stdout_json",
              pythonExitCode: code,
              fallbackReason: "python_stdout_invalid_json",
            }),
          );
          return;
        }

        const unusableReason = pythonRecommendationPayloadUnusableReason(parsed);
        if (unusableReason !== null) {
          resolve(
            await toFallback({
              stderr: [
                `node_python_payload_unusable:${unusableReason}`,
                stderrTrim || "",
              ]
                .filter(Boolean)
                .join(" | "),
              pythonExitCode: code,
              fallbackReason: "python_stdout_unusable_payload",
            }),
          );
          return;
        }

        resolve(parsed as RecommendationGenerateResponse);
      })();
    });

    proc.stdin.write(JSON.stringify(payload));
    proc.stdin.end();
  });
}

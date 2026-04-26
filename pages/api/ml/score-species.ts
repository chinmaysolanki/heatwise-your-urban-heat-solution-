/**
 * POST /api/ml/score-species
 *
 * Calls the trained species ML models (species_scorer + heat_scorer) via a
 * Python child process and returns ML scores for each candidate species.
 *
 * Request body:
 *   {
 *     species: Array<{ species_key, climate_suitability, sunlight_preference,
 *                       water_demand, maintenance_need, root_aggressiveness,
 *                       pollinator_value, edible, child_pet_safety,
 *                       native_support, container_suitability,
 *                       cooling_contribution, privacy_contribution,
 *                       growth_habit }>,
 *     scenario: {
 *       sun: "full"|"partial"|"shade",
 *       water_availability: "scarce"|"moderate"|"plentiful",
 *       wind_level: "low"|"medium"|"high",
 *       heat_exposure: "low"|"moderate"|"high"|"extreme",
 *       purpose_primary: "cooling"|"food"|"aesthetic"|"privacy"|"biodiversity"|"mixed",
 *       maintenance_preference: "minimal"|"low"|"moderate"|"high",
 *       pet_safe_required: 0|1,
 *       edible_preferred: 0|1,
 *       floor_level: number,
 *       area_m2: number,
 *       space_type: "outdoor_rooftop"|"outdoor_balcony"|"outdoor_terrace"|"indoor",
 *     }
 *   }
 *
 * Response:
 *   { scored: [{ species_key, relevance_score, heat_score }] }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { spawn } from "child_process";
import path from "path";

export const config = { api: { bodyParser: { sizeLimit: "1mb" } } };

const ML_CWD      = process.env.HEATWISE_ML_CWD      ?? "./ml";
const REGISTRY_DIR= process.env.HEATWISE_REGISTRY_DIR ?? "./ml/registry";

function runPythonScorer(payload: object): Promise<{ scored: ScoredSpecies[] }> {
  return new Promise((resolve, reject) => {
    const cwd = path.resolve(process.cwd(), ML_CWD);

    const python = spawn(
      "python3",
      ["-m", "serving.scoring.species_ml_scorer"],
      {
        cwd,
        env: {
          ...process.env,
          HEATWISE_REGISTRY_DIR: path.resolve(process.cwd(), REGISTRY_DIR),
          PYTHONPATH: cwd,
        },
      },
    );

    let stdout = "";
    let stderr = "";
    python.stdout.on("data", (d) => { stdout += d.toString(); });
    python.stderr.on("data", (d) => { stderr += d.toString(); });

    python.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`scorer exited ${code}: ${stderr.slice(0, 400)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`scorer non-JSON output: ${stdout.slice(0, 200)}`));
      }
    });

    python.on("error", reject);
    python.stdin.write(JSON.stringify({ ...payload, registry_dir: REGISTRY_DIR }));
    python.stdin.end();
  });
}

type ScoredSpecies = {
  species_key:     string;
  relevance_score: number | null;
  heat_score:      number | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const { species, scenario } = req.body ?? {};

  if (!Array.isArray(species) || species.length === 0) {
    res.status(400).json({ message: "species array required" });
    return;
  }
  if (!scenario || typeof scenario !== "object") {
    res.status(400).json({ message: "scenario object required" });
    return;
  }

  try {
    const result = await runPythonScorer({ species, scenario });
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "ML scoring failed";
    res.status(500).json({ message });
  }
}

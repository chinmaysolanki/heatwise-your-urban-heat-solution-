export type RankingDatasetRow = {
  // identity / join keys
  runId: string;
  candidateId: string;
  recommendationId: string;
  projectId: string | null;
  photoSessionId: string | null;
  runCreatedAt: string;
  candidateCreatedAt: string;

  // features: project input fields (flattened, best-effort)
  input_spaceType?: string | null;
  input_widthM?: number | null;
  input_lengthM?: number | null;
  input_floorLevel?: number | null;
  input_sunExposure?: string | null;
  input_windLevel?: string | null;
  input_waterAccess?: boolean | null;
  input_budgetRange?: string | null;
  input_maintenanceLevel?: string | null;
  input_primaryGoal?: string | null;

  // features: candidate-level
  candidateRank: number;
  layoutName: string;
  layoutType?: string | null;
  cost_totalMin?: number | null;
  cost_totalMax?: number | null;
  cost_currency?: string | null;
  heat_estimatedDropC?: number | null;
  modules_count?: number | null;
  plants_count?: number | null;

  // labels
  label_viewed: 0 | 1;
  label_expanded: 0 | 1;
  label_saved: 0 | 1;
  label_installationRequested: 0 | 1;
};

export type RankingDatasetDiagnostics = {
  totalRows: number;
  pctMissingDimensions: number;
  pctMissingCost: number;
  pctMissingHeat: number;
  pctMissingAnyLabel: number;
};

function safeJsonParse<T = any>(s: unknown): T | null {
  if (typeof s !== "string" || !s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

function num(v: any): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function bool(v: any): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function str(v: any): string | null {
  if (typeof v === "string") return v;
  return v == null ? null : String(v);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv(rows: RankingDatasetRow[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]) as (keyof RankingDatasetRow)[];
  const header = cols.join(",");
  const lines = rows.map(r => cols.map(c => csvEscape((r as any)[c])).join(","));
  return [header, ...lines].join("\n");
}

export function computeRankingDatasetDiagnostics(rows: RankingDatasetRow[]): RankingDatasetDiagnostics {
  const total = rows.length || 0;
  if (!total) {
    return {
      totalRows: 0,
      pctMissingDimensions: 0,
      pctMissingCost: 0,
      pctMissingHeat: 0,
      pctMissingAnyLabel: 0,
    };
  }

  let missingDims = 0;
  let missingCost = 0;
  let missingHeat = 0;
  let missingLabels = 0;

  for (const r of rows) {
    if (r.input_widthM == null || r.input_lengthM == null) missingDims++;
    if (r.cost_totalMin == null && r.cost_totalMax == null) missingCost++;
    if (r.heat_estimatedDropC == null) missingHeat++;
    if (
      r.label_viewed === 0 &&
      r.label_expanded === 0 &&
      r.label_saved === 0 &&
      r.label_installationRequested === 0
    ) {
      missingLabels++;
    }
  }

  const pct = (n: number) => (n * 100) / total;

  return {
    totalRows: total,
    pctMissingDimensions: pct(missingDims),
    pctMissingCost: pct(missingCost),
    pctMissingHeat: pct(missingHeat),
    pctMissingAnyLabel: pct(missingLabels),
  };
}

export function buildRankingDatasetRows(params: {
  runs: Array<{
    id: string;
    createdAt: Date;
    input: string;
    projectId: string | null;
    photoSessionId: string | null;
    candidates: Array<{
      id: string;
      createdAt: Date;
      rank: number;
      recommendationId: string;
      layoutName: string;
      costEstimate: string;
      heatEstimate: string;
      layoutSchema: string;
      feedbackEvents: Array<{
        id: string;
        action: string;
        candidateId: string | null;
        recommendationId: string;
        projectId: string | null;
        extra: string | null;
        timestamp: Date;
      }>;
    }>;
  }>;
  photoSessions?: Array<{
    id: string;
    widthM: number | null;
    lengthM: number | null;
    floorLevel: number | null;
  }>;
  installationRequests?: Array<{
    projectId: string;
  }>;
}): RankingDatasetRow[] {
  const rows: RankingDatasetRow[] = [];

  const sessionById = new Map<
    string,
    { widthM: number | null; lengthM: number | null; floorLevel: number | null }
  >();
  for (const s of params.photoSessions ?? []) {
    sessionById.set(s.id, {
      widthM: num((s as any).widthM),
      lengthM: num((s as any).lengthM),
      floorLevel: num((s as any).floorLevel),
    });
  }

  const installedProjectIds = new Set<string>();
  for (const ir of params.installationRequests ?? []) {
    if (ir && typeof ir.projectId === "string") {
      installedProjectIds.add(ir.projectId);
    }
  }

  for (const run of params.runs) {
    const input = safeJsonParse<any>(run.input) ?? {};

    for (const cand of run.candidates) {
      const schema = safeJsonParse<any>(cand.layoutSchema) ?? {};
      const cost = safeJsonParse<any>(cand.costEstimate) ?? {};
      const heat =
        safeJsonParse<any>(cand.heatEstimate) ??
        safeJsonParse<any>((cand as any).heatReductionSummary) ??
        {};

      const modules = Array.isArray(schema?.modules) ? schema.modules : null;
      const plants =
        Array.isArray(schema?.plants)
          ? schema.plants
          : Array.isArray(schema?.zones)
            ? schema.zones.flatMap((z: any) => (Array.isArray(z?.plants) ? z.plants : []))
            : null;

      // Label extraction from feedback events (best-effort).
      const actions = (cand.feedbackEvents ?? []).map(e => e.action);
      let label_viewed: 0 | 1 = 0;
      let label_expanded: 0 | 1 = 0;
      let label_saved: 0 | 1 = 0;
      let label_installationRequested: 0 | 1 = 0;

      for (const a of actions) {
        if (a == null) continue;
        const v = String(a).toLowerCase();
        if (v === "view" || v === "viewed") label_viewed = 1;
        if (v === "expand_details" || v === "expand" || v === "expanded") label_expanded = 1;
        if (v === "save" || v === "saved") label_saved = 1;
        if (
          v === "installation_requested" ||
          v === "install_request" ||
          v === "mark_installed"
        ) {
          label_installationRequested = 1;
        }
      }

      if (!label_installationRequested && run.projectId && installedProjectIds.has(run.projectId)) {
        label_installationRequested = 1;
      }

      const row: RankingDatasetRow = {
        runId: run.id,
        candidateId: cand.id,
        recommendationId: cand.recommendationId,
        projectId: run.projectId ?? null,
        photoSessionId: run.photoSessionId ?? null,
        runCreatedAt: run.createdAt.toISOString(),
        candidateCreatedAt: cand.createdAt.toISOString(),

        input_spaceType: str(input.spaceType),
        input_widthM:
          num(input.widthM) ??
          (run.photoSessionId && sessionById.get(run.photoSessionId)?.widthM != null
            ? sessionById.get(run.photoSessionId)!.widthM
            : null),
        input_lengthM:
          num(input.lengthM) ??
          (run.photoSessionId && sessionById.get(run.photoSessionId)?.lengthM != null
            ? sessionById.get(run.photoSessionId)!.lengthM
            : null),
        input_floorLevel:
          num(input.floorLevel) ??
          (run.photoSessionId && sessionById.get(run.photoSessionId)?.floorLevel != null
            ? sessionById.get(run.photoSessionId)!.floorLevel
            : null),
        input_sunExposure: str(input.sunExposure),
        input_windLevel: str(input.windLevel),
        input_waterAccess: bool(input.waterAccess),
        input_budgetRange: str(input.budgetRange),
        input_maintenanceLevel: str(input.maintenanceLevel),
        input_primaryGoal: str(input.primaryGoal),

        candidateRank: cand.rank,
        layoutName: cand.layoutName,
        layoutType: str(schema?.template?.type ?? schema?.layoutType ?? schema?.type),
        cost_totalMin: num(cost?.totalMin),
        cost_totalMax: num(cost?.totalMax),
        cost_currency: str(cost?.currency),
        heat_estimatedDropC: num(heat?.estimatedDropC),
        modules_count: modules ? modules.length : null,
        plants_count: plants ? plants.length : null,

        label_viewed,
        label_expanded,
        label_saved,
        label_installationRequested,
      };

      rows.push(row);
    }
  }

  return rows;
}


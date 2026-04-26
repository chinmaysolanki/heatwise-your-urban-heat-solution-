import { db } from "@/lib/db";

export function monthInWindow(month: number, startMonth: number, endMonth: number): boolean {
  const m = month;
  if (startMonth <= endMonth) return m >= startMonth && m <= endMonth;
  return m >= startMonth || m <= endMonth;
}

export async function listSeasonalWindows(filters: {
  region: string;
  climateZone: string;
  projectType?: string;
}) {
  const { region, climateZone, projectType } = filters;
  return db.seasonalWindow.findMany({
    where: {
      region,
      climateZone,
      ...(projectType
        ? { OR: [{ projectType: null }, { projectType }] }
        : {}),
    },
    orderBy: [{ startMonth: "asc" }],
  });
}

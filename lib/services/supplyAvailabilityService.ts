import type { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export async function listSpeciesAvailability(filters: { region: string; speciesName?: string }) {
  return db.speciesAvailability.findMany({
    where: {
      region: filters.region,
      ...(filters.speciesName ? { speciesName: filters.speciesName } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function upsertSpeciesAvailability(data: Prisma.SpeciesAvailabilityCreateInput) {
  return db.speciesAvailability.create({ data });
}

export async function listMaterialInventory(filters: { region: string; materialType?: string }) {
  return db.materialInventory.findMany({
    where: {
      region: filters.region,
      ...(filters.materialType ? { materialType: filters.materialType } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function upsertMaterialInventory(data: Prisma.MaterialInventoryCreateInput) {
  return db.materialInventory.create({ data });
}

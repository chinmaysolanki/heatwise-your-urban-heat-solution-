-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SpeciesCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "scientificName" TEXT,
    "family" TEXT,
    "category" TEXT,
    "edible" BOOLEAN NOT NULL DEFAULT false,
    "flowering" BOOLEAN NOT NULL DEFAULT false,
    "pet_safe" BOOLEAN NOT NULL DEFAULT false,
    "drought_tolerant" BOOLEAN NOT NULL DEFAULT false,
    "heat_tolerant" BOOLEAN NOT NULL DEFAULT false,
    "low_maintenance" BOOLEAN NOT NULL DEFAULT false,
    "min_sun_hours" INTEGER,
    "max_sun_hours" INTEGER,
    "notes" TEXT,
    "tags_json" TEXT,
    "droughtTolerance" TEXT,
    "sunExposure" TEXT,
    "hardinessZoneMin" INTEGER,
    "hardinessZoneMax" INTEGER,
    "maxHeightCm" REAL,
    "growthHabit" TEXT,
    "nativeRangeNotes" TEXT,
    "invasiveRisk" TEXT,
    "ruleTagsJson" TEXT,
    "mlWeight" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_SpeciesCatalog" ("active", "category", "code", "createdAt", "displayName", "droughtTolerance", "family", "growthHabit", "hardinessZoneMax", "hardinessZoneMin", "id", "invasiveRisk", "maxHeightCm", "mlWeight", "nativeRangeNotes", "ruleTagsJson", "scientificName", "sunExposure", "updatedAt") SELECT "active", "category", "code", "createdAt", "displayName", "droughtTolerance", "family", "growthHabit", "hardinessZoneMax", "hardinessZoneMin", "id", "invasiveRisk", "maxHeightCm", "mlWeight", "nativeRangeNotes", "ruleTagsJson", "scientificName", "sunExposure", "updatedAt" FROM "SpeciesCatalog";
DROP TABLE "SpeciesCatalog";
ALTER TABLE "new_SpeciesCatalog" RENAME TO "SpeciesCatalog";
CREATE UNIQUE INDEX "SpeciesCatalog_code_key" ON "SpeciesCatalog"("code");
CREATE INDEX "SpeciesCatalog_category_idx" ON "SpeciesCatalog"("category");
CREATE INDEX "SpeciesCatalog_active_idx" ON "SpeciesCatalog"("active");
CREATE INDEX "SpeciesCatalog_family_idx" ON "SpeciesCatalog"("family");
CREATE INDEX "SpeciesCatalog_heat_tolerant_idx" ON "SpeciesCatalog"("heat_tolerant");
CREATE INDEX "SpeciesCatalog_drought_tolerant_idx" ON "SpeciesCatalog"("drought_tolerant");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- AlterTable: denormalized SpeciesCatalog.code on candidates for exports / joins when speciesId is null
ALTER TABLE "RecommendationCandidate" ADD COLUMN "speciesCatalogCode" TEXT;

-- CreateIndex
CREATE INDEX "RecommendationCandidate_speciesCatalogCode_idx" ON "RecommendationCandidate"("speciesCatalogCode");

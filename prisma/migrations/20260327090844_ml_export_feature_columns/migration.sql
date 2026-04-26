-- AlterTable
ALTER TABLE "EnvironmentSnapshot" ADD COLUMN "heat_island_score" REAL;
ALTER TABLE "EnvironmentSnapshot" ADD COLUMN "peak_surface_temp_c" REAL;
ALTER TABLE "EnvironmentSnapshot" ADD COLUMN "rainfall_level" TEXT;
ALTER TABLE "EnvironmentSnapshot" ADD COLUMN "shade_level" TEXT;
ALTER TABLE "EnvironmentSnapshot" ADD COLUMN "sunlight_hours" REAL;

-- AlterTable
ALTER TABLE "Space" ADD COLUMN "drainage_quality" TEXT;
ALTER TABLE "Space" ADD COLUMN "length_m" REAL;
ALTER TABLE "Space" ADD COLUMN "water_access" TEXT;
ALTER TABLE "Space" ADD COLUMN "width_m" REAL;

-- AlterTable
ALTER TABLE "UserPreference" ADD COLUMN "edible_preference" BOOLEAN;
ALTER TABLE "UserPreference" ADD COLUMN "flowering_preference" BOOLEAN;
ALTER TABLE "UserPreference" ADD COLUMN "irrigation_allowed" BOOLEAN;
ALTER TABLE "UserPreference" ADD COLUMN "pet_safe_required" BOOLEAN;
ALTER TABLE "UserPreference" ADD COLUMN "preferred_style" TEXT;

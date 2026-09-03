-- AlterTable
-- Backfill the new required column for the existing (2026) rows before making it NOT NULL.
ALTER TABLE "Screening" ADD COLUMN "year" INTEGER;

UPDATE "Screening" SET "year" = 2026 WHERE "year" IS NULL;

ALTER TABLE "Screening" ALTER COLUMN "year" SET NOT NULL;

-- Change unique key from global weekNumber to (year, weekNumber).
DROP INDEX "Screening_weekNumber_key";
CREATE UNIQUE INDEX "Screening_year_weekNumber_key" ON "Screening"("year", "weekNumber");
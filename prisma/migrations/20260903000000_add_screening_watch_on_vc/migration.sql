-- AlterTable
-- Non-VC films default to false later during the re-import; existing weekly
-- picks (2026+) are all watchOnVC so a default of true is correct.
ALTER TABLE "Screening" ADD COLUMN "watchOnVC" BOOLEAN NOT NULL DEFAULT true;

-- Non-VC films have no recorded watch date; allow weekStart to be NULL.
ALTER TABLE "Screening" ALTER COLUMN "weekStart" DROP NOT NULL;

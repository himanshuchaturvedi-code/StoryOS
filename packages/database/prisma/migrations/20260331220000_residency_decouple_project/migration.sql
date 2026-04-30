-- Decouple residency from project: make projectId nullable
-- Step 1: Drop the existing FK constraint
ALTER TABLE "participant_residency_statuses" DROP CONSTRAINT IF EXISTS "participant_residency_statuses_projectId_fkey";

-- Step 2: Make projectId nullable
ALTER TABLE "participant_residency_statuses" ALTER COLUMN "projectId" DROP NOT NULL;

-- Step 3: Re-add FK as nullable
ALTER TABLE "participant_residency_statuses"
  ADD CONSTRAINT "participant_residency_statuses_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: Replace old composite index with person-only index
DROP INDEX IF EXISTS "participant_residency_statuses_personId_projectId_idx";
CREATE INDEX "participant_residency_statuses_personId_idx" ON "participant_residency_statuses"("personId");

-- Step 5: Deduplicate — for rows with identical person+type+country+dates across
-- different projects, keep the oldest record and delete the rest.
-- This uses a CTE that assigns row numbers partitioned by the dedup key.
DELETE FROM "participant_residency_statuses"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY "personId", "residencyType", "country", "provinceState",
                     "effectiveFrom", "effectiveTo"
        ORDER BY "createdAt" ASC
      ) AS rn
    FROM "participant_residency_statuses"
    WHERE "deletedAt" IS NULL
  ) ranked
  WHERE rn > 1
);

-- Step 6: NULL out projectId on remaining rows (residency is person-level now)
UPDATE "participant_residency_statuses" SET "projectId" = NULL;

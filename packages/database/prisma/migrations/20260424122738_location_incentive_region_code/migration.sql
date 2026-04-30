-- AlterEnum
BEGIN;
CREATE TYPE "DocumentCategory_new" AS ENUM ('SCRIPT', 'BUDGET', 'SCHEDULE', 'CONTRACT', 'CHAIN_OF_TITLE', 'INSURANCE', 'FINANCING', 'CORPORATE', 'CORRESPONDENCE', 'CAVCO_PART_A', 'CAVCO_PART_B', 'ELIGIBILITY_CERTIFICATE', 'VFX_ACTIVITY_REPORT', 'TAX_CLAIM_FORM', 'COMPLETION_CERTIFICATE', 'BROADCASTER_COMMITMENT', 'DISTRIBUTION_COMMITMENT', 'OTHER');
ALTER TABLE "public"."documents" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "documents" ALTER COLUMN "category" TYPE "DocumentCategory_new" USING ("category"::text::"DocumentCategory_new");
ALTER TYPE "DocumentCategory" RENAME TO "DocumentCategory_old";
ALTER TYPE "DocumentCategory_new" RENAME TO "DocumentCategory";
DROP TYPE "public"."DocumentCategory_old";
ALTER TABLE "documents" ALTER COLUMN "category" SET DEFAULT 'OTHER';
COMMIT;

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "incentiveRegionCode" TEXT;

-- CreateIndex
CREATE INDEX "locations_organizationId_incentiveRegionCode_idx" ON "locations"("organizationId", "incentiveRegionCode");

-- CreateIndex
CREATE UNIQUE INDEX "locations_organizationId_incentiveRegionCode_key" ON "locations"("organizationId", "incentiveRegionCode") WHERE "incentiveRegionCode" IS NOT NULL AND "deletedAt" IS NULL;


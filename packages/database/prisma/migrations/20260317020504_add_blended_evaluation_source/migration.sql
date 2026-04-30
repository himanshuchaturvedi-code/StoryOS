-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('LABOUR', 'NON_LABOUR', 'MIXED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('GENERAL', 'DIGITAL_ANIMATION', 'VISUAL_EFFECTS', 'POST_PRODUCTION');

-- CreateEnum
CREATE TYPE "EvaluationSource" AS ENUM ('BUDGET', 'ACTUAL', 'BLENDED');

-- AlterTable
ALTER TABLE "budget_lines" ADD COLUMN     "activityType" "ActivityType",
ADD COLUMN     "expenseType" "ExpenseType",
ADD COLUMN     "isServiceContract" BOOLEAN,
ADD COLUMN     "labourAmount" DECIMAL(14,2),
ADD COLUMN     "locationId" TEXT,
ADD COLUMN     "personId" TEXT,
ADD COLUMN     "productionPhaseId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vendorId" TEXT;

-- AlterTable
ALTER TABLE "program_submissions" ADD COLUMN     "evaluationSource" "EvaluationSource";

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN     "isRelatedParty" BOOLEAN,
ADD COLUMN     "principalPersonId" TEXT;

-- CreateTable
CREATE TABLE "budget_line_annotation_logs" (
    "id" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "budget_line_annotation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_account_sources" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "budgetAccountId" TEXT NOT NULL,
    "source" "EvaluationSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submission_account_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_line_annotation_logs_budgetLineId_idx" ON "budget_line_annotation_logs"("budgetLineId");

-- CreateIndex
CREATE INDEX "budget_line_annotation_logs_organizationId_idx" ON "budget_line_annotation_logs"("organizationId");

-- CreateIndex
CREATE INDEX "budget_line_annotation_logs_changedAt_idx" ON "budget_line_annotation_logs"("changedAt");

-- CreateIndex
CREATE INDEX "submission_account_sources_organizationId_idx" ON "submission_account_sources"("organizationId");

-- CreateIndex
CREATE INDEX "submission_account_sources_submissionId_idx" ON "submission_account_sources"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "submission_account_sources_submissionId_budgetAccountId_key" ON "submission_account_sources"("submissionId", "budgetAccountId");

-- CreateIndex
CREATE INDEX "budget_lines_personId_idx" ON "budget_lines"("personId");

-- CreateIndex
CREATE INDEX "budget_lines_vendorId_idx" ON "budget_lines"("vendorId");

-- CreateIndex
CREATE INDEX "budget_lines_locationId_idx" ON "budget_lines"("locationId");

-- CreateIndex
CREATE INDEX "budget_lines_productionPhaseId_idx" ON "budget_lines"("productionPhaseId");

-- CreateIndex
CREATE INDEX "vendors_principalPersonId_idx" ON "vendors"("principalPersonId");

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_productionPhaseId_fkey" FOREIGN KEY ("productionPhaseId") REFERENCES "production_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line_annotation_logs" ADD CONSTRAINT "budget_line_annotation_logs_budgetLineId_fkey" FOREIGN KEY ("budgetLineId") REFERENCES "budget_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_principalPersonId_fkey" FOREIGN KEY ("principalPersonId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_account_sources" ADD CONSTRAINT "submission_account_sources_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "program_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_account_sources" ADD CONSTRAINT "submission_account_sources_budgetAccountId_fkey" FOREIGN KEY ("budgetAccountId") REFERENCES "budget_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

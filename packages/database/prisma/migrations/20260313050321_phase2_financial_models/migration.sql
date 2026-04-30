/*
  Warnings:

  - You are about to drop the column `grantedById` on the `project_access` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[projectParticipantId,roleTypeId]` on the table `project_participant_roles` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "BudgetAccountType" AS ENUM ('ABOVE_THE_LINE', 'BELOW_THE_LINE_PRODUCTION', 'BELOW_THE_LINE_POST', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetVersionStatus" AS ENUM ('DRAFT', 'LOCKED');

-- CreateEnum
CREATE TYPE "FinanceSourceType" AS ENUM ('FEDERAL_TAX_CREDIT', 'PROVINCIAL_TAX_CREDIT', 'BROADCASTER_LICENSE', 'DISTRIBUTION_ADVANCE', 'PRE_SALE', 'EQUITY', 'GAP_FINANCING', 'GRANT', 'DEFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "FinanceSourceStatus" AS ENUM ('ESTIMATED', 'COMMITTED', 'RECEIVED');

-- AlterTable
ALTER TABLE "project_access" DROP COLUMN "grantedById",
ADD COLUMN     "createdById" TEXT;

-- CreateTable
CREATE TABLE "budget_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "budget_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_template_accounts" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "BudgetAccountType",
    "isHeader" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_template_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseCurrency" TEXT NOT NULL DEFAULT 'CAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_accounts" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "BudgetAccountType",
    "isHeader" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sourceTemplateAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "budget_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_versions" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BudgetVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "budget_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" TEXT NOT NULL,
    "budgetVersionId" TEXT NOT NULL,
    "budgetAccountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(14,4),
    "unitCost" DECIMAL(14,4),
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "fringeRate" DECIMAL(5,4),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "actual_lines" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "budgetAccountId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "description" TEXT,
    "vendor" TEXT,
    "invoiceRef" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "baseCurrencyAmount" DECIMAL(14,2),
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "postedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "actual_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'CAD',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "finance_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_sources" (
    "id" TEXT NOT NULL,
    "financePlanId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" "FinanceSourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" "FinanceSourceStatus" NOT NULL DEFAULT 'ESTIMATED',
    "conditions" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "finance_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_templates_organizationId_idx" ON "budget_templates"("organizationId");

-- CreateIndex
CREATE INDEX "budget_template_accounts_templateId_parentId_idx" ON "budget_template_accounts"("templateId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_template_accounts_templateId_code_key" ON "budget_template_accounts"("templateId", "code");

-- CreateIndex
CREATE INDEX "budgets_organizationId_idx" ON "budgets"("organizationId");

-- CreateIndex
CREATE INDEX "budgets_projectId_idx" ON "budgets"("projectId");

-- CreateIndex
CREATE INDEX "budget_accounts_organizationId_idx" ON "budget_accounts"("organizationId");

-- CreateIndex
CREATE INDEX "budget_accounts_budgetId_parentId_idx" ON "budget_accounts"("budgetId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_accounts_budgetId_code_key" ON "budget_accounts"("budgetId", "code");

-- CreateIndex
CREATE INDEX "budget_versions_organizationId_idx" ON "budget_versions"("organizationId");

-- CreateIndex
CREATE INDEX "budget_versions_budgetId_idx" ON "budget_versions"("budgetId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_versions_budgetId_versionNumber_key" ON "budget_versions"("budgetId", "versionNumber");

-- CreateIndex
CREATE INDEX "budget_lines_organizationId_idx" ON "budget_lines"("organizationId");

-- CreateIndex
CREATE INDEX "budget_lines_budgetVersionId_idx" ON "budget_lines"("budgetVersionId");

-- CreateIndex
CREATE INDEX "budget_lines_budgetAccountId_idx" ON "budget_lines"("budgetAccountId");

-- CreateIndex
CREATE INDEX "actual_lines_organizationId_idx" ON "actual_lines"("organizationId");

-- CreateIndex
CREATE INDEX "actual_lines_budgetId_idx" ON "actual_lines"("budgetId");

-- CreateIndex
CREATE INDEX "actual_lines_budgetAccountId_idx" ON "actual_lines"("budgetAccountId");

-- CreateIndex
CREATE INDEX "actual_lines_budgetId_transactionDate_idx" ON "actual_lines"("budgetId", "transactionDate");

-- CreateIndex
CREATE INDEX "finance_plans_organizationId_idx" ON "finance_plans"("organizationId");

-- CreateIndex
CREATE INDEX "finance_plans_projectId_idx" ON "finance_plans"("projectId");

-- CreateIndex
CREATE INDEX "finance_sources_organizationId_idx" ON "finance_sources"("organizationId");

-- CreateIndex
CREATE INDEX "finance_sources_financePlanId_idx" ON "finance_sources"("financePlanId");

-- CreateIndex
CREATE INDEX "organization_members_organizationId_idx" ON "organization_members"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "project_participant_roles_projectParticipantId_roleTypeId_key" ON "project_participant_roles"("projectParticipantId", "roleTypeId");

-- AddForeignKey
ALTER TABLE "budget_template_accounts" ADD CONSTRAINT "budget_template_accounts_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "budget_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_template_accounts" ADD CONSTRAINT "budget_template_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "budget_template_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_accounts" ADD CONSTRAINT "budget_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "budget_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_versions" ADD CONSTRAINT "budget_versions_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budgetVersionId_fkey" FOREIGN KEY ("budgetVersionId") REFERENCES "budget_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budgetAccountId_fkey" FOREIGN KEY ("budgetAccountId") REFERENCES "budget_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_lines" ADD CONSTRAINT "actual_lines_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "budgets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actual_lines" ADD CONSTRAINT "actual_lines_budgetAccountId_fkey" FOREIGN KEY ("budgetAccountId") REFERENCES "budget_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_plans" ADD CONSTRAINT "finance_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_sources" ADD CONSTRAINT "finance_sources_financePlanId_fkey" FOREIGN KEY ("financePlanId") REFERENCES "finance_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

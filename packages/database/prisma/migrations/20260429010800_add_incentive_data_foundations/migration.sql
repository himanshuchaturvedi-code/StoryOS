-- AlterTable
ALTER TABLE "budget_lines" ADD COLUMN     "taxCreditIneligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxCreditIneligibleReason" TEXT;

-- AlterTable
ALTER TABLE "corporate_ownerships" ADD COLUMN     "childEntityProvinceState" TEXT,
ADD COLUMN     "parentEntityProvinceState" TEXT;

-- AlterTable
ALTER TABLE "finance_sources" ADD COLUMN     "attributionType" TEXT,
ADD COLUMN     "originProvince" TEXT;

-- AlterTable
ALTER TABLE "project_ownerships" ADD COLUMN     "entityProvinceState" TEXT;

-- AlterTable
ALTER TABLE "rights_control_facts" ADD COLUMN     "holderProvinceState" TEXT,
ADD COLUMN     "retentionYears" INTEGER;

-- AlterEnum
ALTER TYPE "RequirementCategory" ADD VALUE 'PRODUCER_CREDIT';

-- AlterTable
ALTER TABLE "finance_sources" ADD COLUMN     "originScope" TEXT;

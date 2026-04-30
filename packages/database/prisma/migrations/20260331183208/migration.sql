-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentCategory" ADD VALUE 'CAVCO_CERTIFICATION';
ALTER TYPE "DocumentCategory" ADD VALUE 'PROVINCIAL_CERTIFICATION';
ALTER TYPE "DocumentCategory" ADD VALUE 'VFX_ELIGIBLE_ACTIVITY';
ALTER TYPE "DocumentCategory" ADD VALUE 'TAX_FILING';
ALTER TYPE "DocumentCategory" ADD VALUE 'PRODUCTION_COMPLETION';

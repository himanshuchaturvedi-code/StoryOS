-- Add new real-world-aligned certification categories
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'CAVCO_PART_A';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'CAVCO_PART_B';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'ELIGIBILITY_CERTIFICATE';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'VFX_ACTIVITY_REPORT';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'TAX_CLAIM_FORM';
ALTER TYPE "DocumentCategory" ADD VALUE IF NOT EXISTS 'COMPLETION_CERTIFICATE';

-- Note: Old values (CAVCO_CERTIFICATION, PROVINCIAL_CERTIFICATION,
-- VFX_ELIGIBLE_ACTIVITY, TAX_FILING, PRODUCTION_COMPLETION) are left in the
-- Postgres enum but removed from the Prisma schema and TypeScript enum.
-- Postgres does not support DROP VALUE from enums without recreating the type.
-- These orphan values are harmless — Prisma will never write them, and no rows
-- reference them. A future migration can recreate the type if cleanup is desired.

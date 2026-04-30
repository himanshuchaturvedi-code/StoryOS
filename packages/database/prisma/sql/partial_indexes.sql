-- ─────────────────────────────────────────────────────────────────────────────
-- Custom partial indexes for StoryOS.
--
-- These cannot be expressed in schema.prisma because Prisma does not support
-- WHERE-filtered unique indexes. Run this file once after the initial migration:
--
--   npm run db:indexes -w packages/database
--
-- Applying it twice is safe — each statement uses CREATE UNIQUE INDEX IF NOT EXISTS.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enforce a single primary location per project among non-deleted rows.
--
-- The service layer (LocationsService.clearPrimary) already atomically clears
-- the previous primary before setting a new one. This index is the database-level
-- guarantee that enforces the invariant even if the service logic is bypassed
-- (direct DB writes, future API surface, migrations, etc.).
--
-- NULL rows (soft-deleted) are excluded so restoring a deleted row does not
-- accidentally violate the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS project_location_primary_unique
  ON project_locations ("projectId")
  WHERE "isPrimary" = TRUE AND "deletedAt" IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK CONSTRAINTS — Budget Line Eligibility Annotation (Phase 5)
--
-- These enforce data integrity for the eligibility annotation fields
-- added to budget_lines. See PART-A-CALCULATION-ARCHITECTURE.md §6.4 / §12.4.
-- ─────────────────────────────────────────────────────────────────────────────

-- At most one of personId / vendorId may be set on a budget line.
DO $$ BEGIN
  ALTER TABLE budget_lines ADD CONSTRAINT chk_party_exclusive
    CHECK (NOT ("personId" IS NOT NULL AND "vendorId" IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- labourAmount is required when expenseType = MIXED.
DO $$ BEGIN
  ALTER TABLE budget_lines ADD CONSTRAINT chk_labour_amount_for_mixed
    CHECK ("expenseType" != 'MIXED' OR "labourAmount" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- labourAmount cannot exceed the line amount.
DO $$ BEGIN
  ALTER TABLE budget_lines ADD CONSTRAINT chk_labour_amount_ceiling
    CHECK ("labourAmount" IS NULL OR "labourAmount" <= "amount");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- isServiceContract = true requires a vendorId.
DO $$ BEGIN
  ALTER TABLE budget_lines ADD CONSTRAINT chk_service_contract_requires_vendor
    CHECK ("isServiceContract" IS NOT TRUE OR "vendorId" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PARTIAL INDEXES — Budget Line Eligibility Annotation (Phase 5)
--
-- Support Part A calculator queries that filter on annotation FKs.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_budget_lines_version_expense
  ON budget_lines ("budgetVersionId", "expenseType")
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_budget_lines_person
  ON budget_lines ("personId")
  WHERE "personId" IS NOT NULL AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_budget_lines_vendor
  ON budget_lines ("vendorId")
  WHERE "vendorId" IS NOT NULL AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_budget_lines_location
  ON budget_lines ("locationId")
  WHERE "locationId" IS NOT NULL AND "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS idx_budget_lines_phase
  ON budget_lines ("productionPhaseId")
  WHERE "productionPhaseId" IS NOT NULL AND "deletedAt" IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- TEMPORAL OVERLAP EXCLUSION CONSTRAINTS (Phase 3 — requires btree_gist)
--
-- The five temporal tables below use an effectiveFrom / effectiveTo range to
-- capture validity windows. The application enforces non-overlap at the service
-- layer (ConflictException on insert/update). For production hardening, these
-- exclusion constraints provide a DB-level guarantee.
--
-- Prerequisites:
--   CREATE EXTENSION IF NOT EXISTS btree_gist;
--
-- IMPORTANT: PostgreSQL EXCLUDE USING gist requires non-null range bounds.
-- Treat NULL effectiveTo as "infinity" by substituting a far-future sentinel
-- date (e.g. '9999-12-31') before insert when using these constraints.
-- The temporal.ts helpers (asOf / currentlyEffective) remain NULL-based and
-- are unaffected — they only query, they do not insert.
--
-- Apply these constraints once per environment when you are ready to enable
-- the btree_gist extension:
--
--   ALTER TABLE vendor_eligibilities
--     ADD CONSTRAINT no_overlap_vendor_eligibility
--     EXCLUDE USING gist (
--       "organizationId"  WITH =,
--       "vendorId"        WITH =,
--       "programCode"     WITH =,
--       tstzrange("effectiveFrom", COALESCE("effectiveTo", '9999-12-31'), '[)') WITH &&
--     ) WHERE ("deletedAt" IS NULL);
--
--   ALTER TABLE participant_residency_statuses
--     ADD CONSTRAINT no_overlap_residency
--     EXCLUDE USING gist (
--       "organizationId"  WITH =,
--       "personId"        WITH =,
--       "projectId"       WITH =,
--       tstzrange("effectiveFrom", COALESCE("effectiveTo", '9999-12-31'), '[)') WITH &&
--     ) WHERE ("deletedAt" IS NULL);
--
--   ALTER TABLE corporate_ownerships
--     ADD CONSTRAINT no_overlap_corporate_ownership
--     EXCLUDE USING gist (
--       "organizationId"     WITH =,
--       "parentEntityName"   WITH =,
--       "childEntityName"    WITH =,
--       tstzrange("effectiveFrom", COALESCE("effectiveTo", '9999-12-31'), '[)') WITH &&
--     ) WHERE ("deletedAt" IS NULL);
--
--   ALTER TABLE project_ownerships
--     ADD CONSTRAINT no_overlap_project_ownership
--     EXCLUDE USING gist (
--       "organizationId"  WITH =,
--       "projectId"       WITH =,
--       "entityName"      WITH =,
--       tstzrange("effectiveFrom", COALESCE("effectiveTo", '9999-12-31'), '[)') WITH &&
--     ) WHERE ("deletedAt" IS NULL);
--
--   ALTER TABLE rights_control_facts
--     ADD CONSTRAINT no_overlap_rights_control
--     EXCLUDE USING gist (
--       "organizationId"  WITH =,
--       "projectId"       WITH =,
--       "controlType"     WITH =,
--       tstzrange("effectiveFrom", COALESCE("effectiveTo", '9999-12-31'), '[)') WITH &&
--     ) WHERE ("deletedAt" IS NULL);
-- ─────────────────────────────────────────────────────────────────────────────
-- DataMigration: Seed OFTTC and CMF role mappings from existing CPTC mappings.
-- OFTTC and CMF use the same 8 CAVCO key creative role codes as CPTC.
-- This enables the derived-role path for these programs (Phase 5 cutover).

-- Template accounts: copy CPTC mappings → OFTTC
INSERT INTO "budget_template_account_role_mappings" ("id", "budgetTemplateAccountId", "programCode", "roleCode", "pointsOverride", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "budgetTemplateAccountId",
  'OFTTC',
  "roleCode",
  NULL,
  NOW(),
  NOW()
FROM "budget_template_account_role_mappings"
WHERE "programCode" = 'CPTC'
ON CONFLICT ("budgetTemplateAccountId", "programCode", "roleCode") DO NOTHING;

-- Template accounts: copy CPTC mappings → CMF
INSERT INTO "budget_template_account_role_mappings" ("id", "budgetTemplateAccountId", "programCode", "roleCode", "pointsOverride", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "budgetTemplateAccountId",
  'CMF',
  "roleCode",
  NULL,
  NOW(),
  NOW()
FROM "budget_template_account_role_mappings"
WHERE "programCode" = 'CPTC'
ON CONFLICT ("budgetTemplateAccountId", "programCode", "roleCode") DO NOTHING;

-- Budget accounts: copy CPTC mappings → OFTTC
INSERT INTO "budget_account_role_mappings" ("id", "budgetAccountId", "programCode", "roleCode", "pointsOverride", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "budgetAccountId",
  'OFTTC',
  "roleCode",
  NULL,
  NOW(),
  NOW()
FROM "budget_account_role_mappings"
WHERE "programCode" = 'CPTC'
ON CONFLICT ("budgetAccountId", "programCode", "roleCode") DO NOTHING;

-- Budget accounts: copy CPTC mappings → CMF
INSERT INTO "budget_account_role_mappings" ("id", "budgetAccountId", "programCode", "roleCode", "pointsOverride", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "budgetAccountId",
  'CMF',
  "roleCode",
  NULL,
  NOW(),
  NOW()
FROM "budget_account_role_mappings"
WHERE "programCode" = 'CPTC'
ON CONFLICT ("budgetAccountId", "programCode", "roleCode") DO NOTHING;

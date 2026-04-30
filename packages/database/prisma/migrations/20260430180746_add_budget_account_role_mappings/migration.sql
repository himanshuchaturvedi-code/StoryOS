-- CreateTable
CREATE TABLE "budget_template_account_role_mappings" (
    "id" TEXT NOT NULL,
    "budgetTemplateAccountId" TEXT NOT NULL,
    "programCode" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "pointsOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_template_account_role_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_account_role_mappings" (
    "id" TEXT NOT NULL,
    "budgetAccountId" TEXT NOT NULL,
    "programCode" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "pointsOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_account_role_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "budget_template_account_role_mappings_budgetTemplateAccount_idx" ON "budget_template_account_role_mappings"("budgetTemplateAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_template_account_role_mappings_budgetTemplateAccount_key" ON "budget_template_account_role_mappings"("budgetTemplateAccountId", "programCode", "roleCode");

-- CreateIndex
CREATE INDEX "budget_account_role_mappings_budgetAccountId_idx" ON "budget_account_role_mappings"("budgetAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "budget_account_role_mappings_budgetAccountId_programCode_ro_key" ON "budget_account_role_mappings"("budgetAccountId", "programCode", "roleCode");

-- AddForeignKey
ALTER TABLE "budget_template_account_role_mappings" ADD CONSTRAINT "budget_template_account_role_mappings_budgetTemplateAccoun_fkey" FOREIGN KEY ("budgetTemplateAccountId") REFERENCES "budget_template_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_account_role_mappings" ADD CONSTRAINT "budget_account_role_mappings_budgetAccountId_fkey" FOREIGN KEY ("budgetAccountId") REFERENCES "budget_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: Migrate existing cptcRole into role mapping tables (CPTC ONLY)
-- Do NOT create mappings for other programs (OFTTC, CMF, etc.)
INSERT INTO "budget_template_account_role_mappings" ("id", "budgetTemplateAccountId", "programCode", "roleCode", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "id",
  'CPTC',
  "cptcRole",
  NOW(),
  NOW()
FROM "budget_template_accounts"
WHERE "cptcRole" IS NOT NULL;

INSERT INTO "budget_account_role_mappings" ("id", "budgetAccountId", "programCode", "roleCode", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "id",
  'CPTC',
  "cptcRole",
  NOW(),
  NOW()
FROM "budget_accounts"
WHERE "cptcRole" IS NOT NULL;

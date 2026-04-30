-- CreateEnum
CREATE TYPE "VendorType" AS ENUM ('PRODUCTION_SERVICE', 'POST_PRODUCTION', 'VFX', 'ANIMATION', 'SOUND', 'MUSIC', 'EQUIPMENT_RENTAL', 'STUDIO_RENTAL', 'CATERING', 'TRANSPORTATION', 'INSURANCE', 'LEGAL', 'OTHER');

-- CreateEnum
CREATE TYPE "EligibilityStatus" AS ENUM ('ELIGIBLE', 'NOT_ELIGIBLE', 'UNDER_REVIEW', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ControlType" AS ENUM ('CREATIVE_CONTROL', 'FINANCIAL_CONTROL', 'COPYRIGHT_OWNERSHIP', 'DISTRIBUTION_RIGHTS', 'UNDERLYING_RIGHTS');

-- CreateEnum
CREATE TYPE "ResidencyType" AS ENUM ('CITIZEN', 'PERMANENT_RESIDENT', 'TEMPORARY_RESIDENT', 'NON_RESIDENT');

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "name" TEXT NOT NULL,
    "vendorType" "VendorType" NOT NULL,
    "legalName" TEXT,
    "registrationNum" TEXT,
    "country" TEXT NOT NULL,
    "provinceState" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "isCanadianOwned" BOOLEAN,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_eligibilities" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programCode" TEXT NOT NULL,
    "status" "EligibilityStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "certificationRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vendor_eligibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_days" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "personId" TEXT NOT NULL,
    "roleTypeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productionPhaseId" TEXT,
    "activityDate" DATE NOT NULL,
    "hoursWorked" DECIMAL(4,1),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "activity_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_facts" (
    "id" TEXT NOT NULL,
    "actualLineId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT,
    "vendorId" TEXT,
    "personId" TEXT,
    "locationId" TEXT,
    "productionPhaseId" TEXT,
    "budgetAccountId" TEXT,
    "eligiblePortion" DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    "labourFlag" BOOLEAN NOT NULL DEFAULT false,
    "serviceFlag" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "expense_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_ownerships" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "parentEntityName" TEXT NOT NULL,
    "parentEntityCountry" TEXT NOT NULL,
    "childEntityName" TEXT NOT NULL,
    "childEntityCountry" TEXT NOT NULL,
    "ownershipPercentage" DECIMAL(5,2) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "corporate_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_ownerships" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "entityName" TEXT NOT NULL,
    "entityCountry" TEXT NOT NULL,
    "ownershipPercentage" DECIMAL(5,2) NOT NULL,
    "isProducer" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "project_ownerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rights_control_facts" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "controlType" "ControlType" NOT NULL,
    "holderName" TEXT NOT NULL,
    "holderCountry" TEXT NOT NULL,
    "assertion" TEXT NOT NULL,
    "evidenceNotes" TEXT,
    "documentId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rights_control_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participant_residency_statuses" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "residencyType" "ResidencyType" NOT NULL,
    "country" TEXT NOT NULL,
    "provinceState" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "participant_residency_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendors_organizationId_idx" ON "vendors"("organizationId");

-- CreateIndex
CREATE INDEX "vendors_organizationId_vendorType_idx" ON "vendors"("organizationId", "vendorType");

-- CreateIndex
CREATE INDEX "vendor_eligibilities_organizationId_idx" ON "vendor_eligibilities"("organizationId");

-- CreateIndex
CREATE INDEX "vendor_eligibilities_vendorId_idx" ON "vendor_eligibilities"("vendorId");

-- CreateIndex
CREATE INDEX "vendor_eligibilities_vendorId_programCode_idx" ON "vendor_eligibilities"("vendorId", "programCode");

-- CreateIndex
CREATE INDEX "vendor_eligibilities_effectiveFrom_effectiveTo_idx" ON "vendor_eligibilities"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "activity_days_organizationId_idx" ON "activity_days"("organizationId");

-- CreateIndex
CREATE INDEX "activity_days_projectId_activityDate_idx" ON "activity_days"("projectId", "activityDate");

-- CreateIndex
CREATE INDEX "activity_days_projectId_locationId_idx" ON "activity_days"("projectId", "locationId");

-- CreateIndex
CREATE INDEX "activity_days_projectId_roleTypeId_idx" ON "activity_days"("projectId", "roleTypeId");

-- CreateIndex
CREATE INDEX "activity_days_personId_activityDate_idx" ON "activity_days"("personId", "activityDate");

-- CreateIndex
CREATE INDEX "activity_days_locationId_activityDate_idx" ON "activity_days"("locationId", "activityDate");

-- CreateIndex
CREATE INDEX "activity_days_productionPhaseId_idx" ON "activity_days"("productionPhaseId");

-- CreateIndex
CREATE UNIQUE INDEX "expense_facts_actualLineId_key" ON "expense_facts"("actualLineId");

-- CreateIndex
CREATE INDEX "expense_facts_organizationId_idx" ON "expense_facts"("organizationId");

-- CreateIndex
CREATE INDEX "expense_facts_projectId_idx" ON "expense_facts"("projectId");

-- CreateIndex
CREATE INDEX "expense_facts_vendorId_idx" ON "expense_facts"("vendorId");

-- CreateIndex
CREATE INDEX "expense_facts_personId_idx" ON "expense_facts"("personId");

-- CreateIndex
CREATE INDEX "expense_facts_locationId_idx" ON "expense_facts"("locationId");

-- CreateIndex
CREATE INDEX "expense_facts_productionPhaseId_idx" ON "expense_facts"("productionPhaseId");

-- CreateIndex
CREATE INDEX "corporate_ownerships_organizationId_idx" ON "corporate_ownerships"("organizationId");

-- CreateIndex
CREATE INDEX "corporate_ownerships_childEntityName_idx" ON "corporate_ownerships"("childEntityName");

-- CreateIndex
CREATE INDEX "corporate_ownerships_parentEntityName_idx" ON "corporate_ownerships"("parentEntityName");

-- CreateIndex
CREATE INDEX "corporate_ownerships_effectiveFrom_effectiveTo_idx" ON "corporate_ownerships"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "project_ownerships_organizationId_idx" ON "project_ownerships"("organizationId");

-- CreateIndex
CREATE INDEX "project_ownerships_projectId_idx" ON "project_ownerships"("projectId");

-- CreateIndex
CREATE INDEX "project_ownerships_effectiveFrom_effectiveTo_idx" ON "project_ownerships"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "rights_control_facts_organizationId_idx" ON "rights_control_facts"("organizationId");

-- CreateIndex
CREATE INDEX "rights_control_facts_projectId_idx" ON "rights_control_facts"("projectId");

-- CreateIndex
CREATE INDEX "rights_control_facts_projectId_controlType_idx" ON "rights_control_facts"("projectId", "controlType");

-- CreateIndex
CREATE INDEX "rights_control_facts_effectiveFrom_effectiveTo_idx" ON "rights_control_facts"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "participant_residency_statuses_organizationId_idx" ON "participant_residency_statuses"("organizationId");

-- CreateIndex
CREATE INDEX "participant_residency_statuses_personId_projectId_idx" ON "participant_residency_statuses"("personId", "projectId");

-- CreateIndex
CREATE INDEX "participant_residency_statuses_effectiveFrom_effectiveTo_idx" ON "participant_residency_statuses"("effectiveFrom", "effectiveTo");

-- AddForeignKey
ALTER TABLE "vendor_eligibilities" ADD CONSTRAINT "vendor_eligibilities_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_days" ADD CONSTRAINT "activity_days_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_days" ADD CONSTRAINT "activity_days_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_days" ADD CONSTRAINT "activity_days_roleTypeId_fkey" FOREIGN KEY ("roleTypeId") REFERENCES "participant_role_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_days" ADD CONSTRAINT "activity_days_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_days" ADD CONSTRAINT "activity_days_productionPhaseId_fkey" FOREIGN KEY ("productionPhaseId") REFERENCES "production_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_facts" ADD CONSTRAINT "expense_facts_actualLineId_fkey" FOREIGN KEY ("actualLineId") REFERENCES "actual_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_facts" ADD CONSTRAINT "expense_facts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_facts" ADD CONSTRAINT "expense_facts_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_facts" ADD CONSTRAINT "expense_facts_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_facts" ADD CONSTRAINT "expense_facts_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_facts" ADD CONSTRAINT "expense_facts_productionPhaseId_fkey" FOREIGN KEY ("productionPhaseId") REFERENCES "production_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_ownerships" ADD CONSTRAINT "project_ownerships_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rights_control_facts" ADD CONSTRAINT "rights_control_facts_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rights_control_facts" ADD CONSTRAINT "rights_control_facts_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_residency_statuses" ADD CONSTRAINT "participant_residency_statuses_personId_fkey" FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participant_residency_statuses" ADD CONSTRAINT "participant_residency_statuses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

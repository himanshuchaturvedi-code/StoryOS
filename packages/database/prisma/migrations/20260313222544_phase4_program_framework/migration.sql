-- CreateEnum
CREATE TYPE "ProgramScope" AS ENUM ('FEDERAL', 'PROVINCIAL', 'MUNICIPAL', 'PRIVATE_FUND', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "RequirementCategory" AS ENUM ('EXPENDITURE_THRESHOLD', 'LABOUR_EXPENDITURE', 'KEY_CREATIVE_TEST', 'CANADIAN_CONTROL', 'RESIDENCY_TEST', 'ACTIVITY_DAY_MINIMUM', 'REGIONAL_SPEND', 'FORMAT_ELIGIBILITY', 'VENDOR_ELIGIBILITY', 'RIGHTS_CONTROL', 'DOCUMENTATION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FactSourceType" AS ENUM ('EXPENSE_FACT', 'ACTIVITY_DAY', 'VENDOR_ELIGIBILITY', 'PARTICIPANT_RESIDENCY', 'CORPORATE_OWNERSHIP', 'PROJECT_OWNERSHIP', 'RIGHTS_CONTROL_FACT', 'BUDGET_ACTUAL', 'PROJECT_FORMAT', 'PROJECT_METADATA', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "ProjectProgramStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ABANDONED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AssessmentResult" AS ENUM ('PASS', 'FAIL', 'PARTIAL', 'NOT_EVALUATED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('FACT_QUERY', 'DOCUMENT', 'MANUAL_ENTRY');

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "ProgramScope" NOT NULL,
    "country" TEXT NOT NULL,
    "provinceState" TEXT,
    "administeredBy" TEXT NOT NULL,
    "website" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_versions" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "versionCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "description" TEXT,
    "sourceDocumentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_requirements" (
    "id" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requirementCategory" "RequirementCategory" NOT NULL,
    "primaryFactSource" "FactSourceType",
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "isBonusEligible" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_programs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "programVersionId" TEXT NOT NULL,
    "createdById" TEXT,
    "status" "ProjectProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetSubmissionDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "project_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_submissions" (
    "id" TEXT NOT NULL,
    "projectProgramId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "evaluationDate" TIMESTAMP(3) NOT NULL,
    "budgetVersionId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "submittedById" TEXT,
    "externalRef" TEXT,
    "responseDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "program_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_evidence" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "factSource" "FactSourceType",
    "factQuery" JSONB,
    "documentId" TEXT,
    "manualPayload" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "submission_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_assessments" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "result" "AssessmentResult" NOT NULL DEFAULT 'NOT_EVALUATED',
    "computedValue" JSONB,
    "calculatorCode" TEXT,
    "calculatorVersion" TEXT,
    "assessedAt" TIMESTAMP(3),
    "assessedById" TEXT,
    "isAutoAssessed" BOOLEAN NOT NULL DEFAULT false,
    "isOverridden" BOOLEAN NOT NULL DEFAULT false,
    "overrideResult" "AssessmentResult",
    "overrideReason" TEXT,
    "overriddenById" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "requirement_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "programs_code_key" ON "programs"("code");

-- CreateIndex
CREATE INDEX "programs_scope_idx" ON "programs"("scope");

-- CreateIndex
CREATE INDEX "programs_country_idx" ON "programs"("country");

-- CreateIndex
CREATE INDEX "program_versions_programId_idx" ON "program_versions"("programId");

-- CreateIndex
CREATE INDEX "program_versions_effectiveFrom_effectiveTo_idx" ON "program_versions"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "program_versions_programId_versionCode_key" ON "program_versions"("programId", "versionCode");

-- CreateIndex
CREATE INDEX "program_requirements_programVersionId_idx" ON "program_requirements"("programVersionId");

-- CreateIndex
CREATE INDEX "program_requirements_programVersionId_requirementCategory_idx" ON "program_requirements"("programVersionId", "requirementCategory");

-- CreateIndex
CREATE UNIQUE INDEX "program_requirements_programVersionId_code_key" ON "program_requirements"("programVersionId", "code");

-- CreateIndex
CREATE INDEX "project_programs_organizationId_idx" ON "project_programs"("organizationId");

-- CreateIndex
CREATE INDEX "project_programs_projectId_idx" ON "project_programs"("projectId");

-- CreateIndex
CREATE INDEX "project_programs_organizationId_status_idx" ON "project_programs"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_programs_projectId_programVersionId_key" ON "project_programs"("projectId", "programVersionId");

-- CreateIndex
CREATE INDEX "program_submissions_organizationId_idx" ON "program_submissions"("organizationId");

-- CreateIndex
CREATE INDEX "program_submissions_projectProgramId_idx" ON "program_submissions"("projectProgramId");

-- CreateIndex
CREATE INDEX "program_submissions_organizationId_status_idx" ON "program_submissions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "submission_evidence_organizationId_idx" ON "submission_evidence"("organizationId");

-- CreateIndex
CREATE INDEX "submission_evidence_submissionId_idx" ON "submission_evidence"("submissionId");

-- CreateIndex
CREATE INDEX "submission_evidence_submissionId_requirementId_idx" ON "submission_evidence"("submissionId", "requirementId");

-- CreateIndex
CREATE INDEX "requirement_assessments_organizationId_idx" ON "requirement_assessments"("organizationId");

-- CreateIndex
CREATE INDEX "requirement_assessments_submissionId_idx" ON "requirement_assessments"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_assessments_submissionId_requirementId_key" ON "requirement_assessments"("submissionId", "requirementId");

-- AddForeignKey
ALTER TABLE "program_versions" ADD CONSTRAINT "program_versions_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_requirements" ADD CONSTRAINT "program_requirements_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "program_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_requirements" ADD CONSTRAINT "program_requirements_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "program_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_programs" ADD CONSTRAINT "project_programs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_programs" ADD CONSTRAINT "project_programs_programVersionId_fkey" FOREIGN KEY ("programVersionId") REFERENCES "program_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_submissions" ADD CONSTRAINT "program_submissions_projectProgramId_fkey" FOREIGN KEY ("projectProgramId") REFERENCES "project_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "program_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "program_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_evidence" ADD CONSTRAINT "submission_evidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_assessments" ADD CONSTRAINT "requirement_assessments_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "program_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_assessments" ADD CONSTRAINT "requirement_assessments_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "program_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ProgramApplicationStatus" AS ENUM ('PREPARING', 'READY', 'FILED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "program_applications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectProgramId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "ProgramApplicationStatus" NOT NULL DEFAULT 'PREPARING',
    "targetFilingDate" TIMESTAMP(3),
    "filedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "program_applications_projectProgramId_key" ON "program_applications"("projectProgramId");

-- CreateIndex
CREATE INDEX "program_applications_organizationId_idx" ON "program_applications"("organizationId");

-- CreateIndex
CREATE INDEX "program_applications_organizationId_status_idx" ON "program_applications"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "program_applications" ADD CONSTRAINT "program_applications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_applications" ADD CONSTRAINT "program_applications_projectProgramId_fkey" FOREIGN KEY ("projectProgramId") REFERENCES "project_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_applications" ADD CONSTRAINT "program_applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

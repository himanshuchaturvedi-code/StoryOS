-- PersonAuditLog table
CREATE TABLE "person_audit_logs" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "changedById" TEXT,
    "fieldName" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "person_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "person_audit_logs_personId_idx" ON "person_audit_logs"("personId");
CREATE INDEX "person_audit_logs_organizationId_idx" ON "person_audit_logs"("organizationId");
CREATE INDEX "person_audit_logs_createdAt_idx" ON "person_audit_logs"("createdAt");

ALTER TABLE "person_audit_logs" ADD CONSTRAINT "person_audit_logs_personId_fkey"
    FOREIGN KEY ("personId") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add isStale flag to program_submissions
ALTER TABLE "program_submissions" ADD COLUMN "isStale" BOOLEAN NOT NULL DEFAULT false;

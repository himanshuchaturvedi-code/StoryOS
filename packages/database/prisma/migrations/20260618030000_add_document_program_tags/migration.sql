-- AlterTable
ALTER TABLE "documents" ADD COLUMN "programCode" TEXT,
ADD COLUMN "programDocumentCode" TEXT;

-- CreateIndex
CREATE INDEX "documents_projectId_programCode_idx" ON "documents"("projectId", "programCode");

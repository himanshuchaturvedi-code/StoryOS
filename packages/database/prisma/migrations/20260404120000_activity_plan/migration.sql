-- CreateTable
CREATE TABLE "activity_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "productionPhaseId" TEXT NOT NULL,
    "plannedDays" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "activity_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activity_plans_projectId_locationId_productionPhaseId_key" ON "activity_plans"("projectId", "locationId", "productionPhaseId");

-- CreateIndex
CREATE INDEX "activity_plans_organizationId_idx" ON "activity_plans"("organizationId");

-- CreateIndex
CREATE INDEX "activity_plans_projectId_idx" ON "activity_plans"("projectId");

-- AddForeignKey
ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_productionPhaseId_fkey" FOREIGN KEY ("productionPhaseId") REFERENCES "production_phases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Planned days must be positive
ALTER TABLE "activity_plans" ADD CONSTRAINT "activity_plans_plannedDays_positive" CHECK ("plannedDays" > 0);

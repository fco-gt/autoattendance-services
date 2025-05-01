-- CreateTable
CREATE TABLE "WorkSchedule" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "entryTime" TEXT NOT NULL,
    "exitTime" TEXT NOT NULL,
    "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 10,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "assignedUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkSchedule_agencyId_idx" ON "WorkSchedule"("agencyId");

-- CreateIndex
CREATE INDEX "WorkSchedule_isDefault_idx" ON "WorkSchedule"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "WorkSchedule_agencyId_name_key" ON "WorkSchedule"("agencyId", "name");

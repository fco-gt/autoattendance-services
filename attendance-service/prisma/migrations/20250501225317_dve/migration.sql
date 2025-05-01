-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('ON_TIME', 'LATE');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'QR', 'NFC');

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "checkInTime" TIMESTAMP(3) NOT NULL,
    "scheduleEntryTime" TEXT,
    "status" "AttendanceStatus",
    "checkOutTime" TIMESTAMP(3),
    "scheduleExitTime" TEXT,
    "date" DATE NOT NULL,
    "methodIn" "AttendanceMethod" NOT NULL,
    "methodOut" "AttendanceMethod",
    "notes" TEXT,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_agencyId_date_idx" ON "AttendanceRecord"("agencyId", "date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_userId_idx" ON "AttendanceRecord"("userId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_userId_date_key" ON "AttendanceRecord"("userId", "date");

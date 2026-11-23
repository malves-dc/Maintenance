-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "timesheetDailyHours" DECIMAL(4,2) NOT NULL DEFAULT 8,
ADD COLUMN     "timesheetEditDays" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "TimesheetEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "villaId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "minutes" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetTimer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "villaId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT,

    CONSTRAINT "TimesheetTimer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimesheetEntry_organizationId_date_idx" ON "TimesheetEntry"("organizationId", "date");

-- CreateIndex
CREATE INDEX "TimesheetEntry_organizationId_userId_date_idx" ON "TimesheetEntry"("organizationId", "userId", "date");

-- CreateIndex
CREATE INDEX "TimesheetEntry_villaId_date_idx" ON "TimesheetEntry"("villaId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetTimer_organizationId_userId_key" ON "TimesheetTimer"("organizationId", "userId");

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetEntry" ADD CONSTRAINT "TimesheetEntry_villaId_fkey" FOREIGN KEY ("villaId") REFERENCES "Villa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetTimer" ADD CONSTRAINT "TimesheetTimer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetTimer" ADD CONSTRAINT "TimesheetTimer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetTimer" ADD CONSTRAINT "TimesheetTimer_villaId_fkey" FOREIGN KEY ("villaId") REFERENCES "Villa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

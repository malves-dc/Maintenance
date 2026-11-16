-- CreateEnum
CREATE TYPE "DistanceSource" AS ENUM ('MANUAL', 'ESTIMATE', 'ROAD');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "roadDistances" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Villa" ADD COLUMN     "defaultOfficeId" TEXT;

-- AlterTable
ALTER TABLE "WorkOrderAssignee" ADD COLUMN     "officeId" TEXT;

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeMember" (
    "organizationId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OfficeMember_pkey" PRIMARY KEY ("officeId","userId")
);

-- CreateTable
CREATE TABLE "VillaOfficeDistance" (
    "organizationId" TEXT NOT NULL,
    "villaId" TEXT NOT NULL,
    "officeId" TEXT NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "source" "DistanceSource" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VillaOfficeDistance_pkey" PRIMARY KEY ("villaId","officeId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Office_organizationId_name_key" ON "Office"("organizationId", "name");

-- CreateIndex
CREATE INDEX "OfficeMember_organizationId_userId_idx" ON "OfficeMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "VillaOfficeDistance_organizationId_idx" ON "VillaOfficeDistance"("organizationId");

-- CreateIndex
CREATE INDEX "VillaOfficeDistance_officeId_idx" ON "VillaOfficeDistance"("officeId");

-- AddForeignKey
ALTER TABLE "Villa" ADD CONSTRAINT "Villa_defaultOfficeId_fkey" FOREIGN KEY ("defaultOfficeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMember" ADD CONSTRAINT "OfficeMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMember" ADD CONSTRAINT "OfficeMember_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficeMember" ADD CONSTRAINT "OfficeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillaOfficeDistance" ADD CONSTRAINT "VillaOfficeDistance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillaOfficeDistance" ADD CONSTRAINT "VillaOfficeDistance_villaId_fkey" FOREIGN KEY ("villaId") REFERENCES "Villa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VillaOfficeDistance" ADD CONSTRAINT "VillaOfficeDistance_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderAssignee" ADD CONSTRAINT "WorkOrderAssignee_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE SET NULL ON UPDATE CASCADE;

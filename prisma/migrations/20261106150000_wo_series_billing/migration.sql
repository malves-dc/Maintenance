-- Work order status "Received"
ALTER TYPE "WorkOrderStatus" ADD VALUE 'RECEIVED' AFTER 'OPEN';

-- Yearly series shared by requests and work orders. Existing records keep their number, under the year
-- they were created (in the company's time zone).
ALTER TABLE "WorkOrder" ADD COLUMN "year" INTEGER;
ALTER TABLE "Request" ADD COLUMN "year" INTEGER;
UPDATE "WorkOrder" w SET "year" = EXTRACT(YEAR FROM (w."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE o."timezone")::int
  FROM "Organization" o WHERE o.id = w."organizationId";
UPDATE "Request" r SET "year" = EXTRACT(YEAR FROM (r."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE o."timezone")::int
  FROM "Organization" o WHERE o.id = r."organizationId";
ALTER TABLE "WorkOrder" ALTER COLUMN "year" SET NOT NULL;
ALTER TABLE "Request" ALTER COLUMN "year" SET NOT NULL;

DROP INDEX "WorkOrder_organizationId_number_key";
DROP INDEX "Request_organizationId_number_key";
CREATE UNIQUE INDEX "WorkOrder_organizationId_year_number_key" ON "WorkOrder"("organizationId", "year", "number");
CREATE UNIQUE INDEX "Request_organizationId_year_number_key" ON "Request"("organizationId", "year", "number");

-- New numbers continue after the highest one in use on either side.
INSERT INTO "Counter" ("organizationId", "key", "value")
SELECT "organizationId", 'series:' || "year", MAX("number")
FROM (
  SELECT "organizationId", "year", "number" FROM "WorkOrder"
  UNION ALL
  SELECT "organizationId", "year", "number" FROM "Request"
) x
GROUP BY "organizationId", "year";

-- Billing
ALTER TABLE "WorkOrder" ADD COLUMN "invoicedAt" TIMESTAMP(3);
ALTER TABLE "WorkOrder" ADD COLUMN "invoiceNumber" TEXT;
ALTER TABLE "WorkOrder" ADD COLUMN "invoicedById" TEXT;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_invoicedById_fkey" FOREIGN KEY ("invoicedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Parts typed by hand
ALTER TABLE "WorkOrderPart" ALTER COLUMN "partId" DROP NOT NULL;
ALTER TABLE "WorkOrderPart" ADD COLUMN "model" TEXT;
ALTER TABLE "WorkOrderPart" ADD COLUMN "description" TEXT;

-- Related work orders
CREATE TABLE "WorkOrderLink" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkOrderLink_fromId_toId_key" ON "WorkOrderLink"("fromId", "toId");
CREATE INDEX "WorkOrderLink_toId_idx" ON "WorkOrderLink"("toId");
ALTER TABLE "WorkOrderLink" ADD CONSTRAINT "WorkOrderLink_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderLink" ADD CONSTRAINT "WorkOrderLink_toId_fkey" FOREIGN KEY ("toId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrderLink" ADD CONSTRAINT "WorkOrderLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

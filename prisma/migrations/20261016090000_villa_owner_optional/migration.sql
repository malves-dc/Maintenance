-- A villa can have only an owner, only a managing company, or both.
ALTER TABLE "Villa" ALTER COLUMN "clientId" DROP NOT NULL;

ALTER TABLE "Villa" ADD CONSTRAINT "Villa_owner_or_manager" CHECK ("clientId" IS NOT NULL OR "managerId" IS NOT NULL);

-- Who the villa's work is billed and reported to, when it has both.
CREATE TYPE "BillTo" AS ENUM ('OWNER', 'MANAGER');

ALTER TABLE "Villa" ADD COLUMN "billTo" "BillTo" NOT NULL DEFAULT 'OWNER';

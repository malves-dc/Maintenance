-- CreateEnum
CREATE TYPE "ConnectivityType" AS ENUM ('DYNDNS', 'VPN');

-- AlterTable
ALTER TABLE "Villa" ADD COLUMN     "connectivityHost" TEXT,
ADD COLUMN     "connectivityPort" INTEGER,
ADD COLUMN     "connectivityType" "ConnectivityType",
ADD COLUMN     "connectivityVpn" TEXT,
ADD COLUMN     "online" BOOLEAN,
ADD COLUMN     "onlineAddress" TEXT,
ADD COLUMN     "onlineCheckedAt" TIMESTAMP(3),
ADD COLUMN     "onlineError" TEXT,
ADD COLUMN     "onlineLatencyMs" INTEGER,
ADD COLUMN     "onlineSince" TIMESTAMP(3);

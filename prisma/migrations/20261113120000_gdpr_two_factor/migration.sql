-- Two-factor sign-in (TOTP) and its recovery codes.
ALTER TABLE "User" ADD COLUMN "totpSecretEnc" TEXT;
ALTER TABLE "User" ADD COLUMN "totpEnabledAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "totpLastStep" INTEGER;
ALTER TABLE "User" ADD COLUMN "totpRecovery" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Off by default: a company turns it on in Settings → Organization (then required for admins and staff who can see access codes).
ALTER TABLE "Organization" ADD COLUMN "require2fa" BOOLEAN NOT NULL DEFAULT false;

-- When a member was deactivated (for the erasure reminder), and erasure by one of several companies.
ALTER TABLE "Membership" ADD COLUMN "deactivatedAt" TIMESTAMP(3);
ALTER TABLE "Membership" ADD COLUMN "erasedAt" TIMESTAMP(3);
-- Members already inactive: the date is unknown, so the retention period counts from now.
UPDATE "Membership" SET "deactivatedAt" = NOW() WHERE "active" = false;

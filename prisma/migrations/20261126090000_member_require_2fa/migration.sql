-- Two-factor sign-in per person (Settings → Staff / Clients): true = required, false = not required, null = the
-- company's rule (lib/two-factor-rules.ts).
ALTER TABLE "Membership" ADD COLUMN "require2fa" BOOLEAN;

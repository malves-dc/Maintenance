-- Prices saved on each completed work order (lib/work-order-prices.ts): billing period, urgent surcharge, trip charges
-- and preparation rate. Later changes to the company's or contract's settings no longer change completed jobs.
ALTER TABLE "WorkOrder" ADD COLUMN "prices" JSONB;

-- Jobs already completed keep today's prices (as currentPrices() works them out: the contract's own where it sets them).
UPDATE "WorkOrder" w
SET "prices" = p."prices"
FROM (
SELECT w2."id", jsonb_build_object(
  'block', CASE WHEN o."timeRounding" IN (0, 15, 30, 60) THEN o."timeRounding" ELSE 30 END,
  'urgent', CASE
    WHEN c."id" IS NOT NULL AND (c."urgentFee" IS NOT NULL OR c."urgentPercent" IS NOT NULL)
      THEN jsonb_build_object('fee', COALESCE(c."urgentFee", 0)::float8, 'percent', COALESCE(c."urgentPercent", 0))
    ELSE jsonb_build_object('fee', o."urgentFee"::float8, 'percent', o."urgentPercent") END,
  'travel', jsonb_build_object(
    'fee', CASE WHEN COALESCE(c."travelIncluded", false) THEN 0 ELSE COALESCE(c."travelFee", o."travelFee")::float8 END,
    'radiusKm', o."travelRadiusKm",
    'kmRate', CASE WHEN COALESCE(c."travelIncluded", false) THEN 0 ELSE COALESCE(c."travelKmRate", o."travelKmRate")::float8 END,
    'perTechnician', o."travelPerTechnician",
    'included', COALESCE(c."travelIncluded", false)),
  'prepRate', COALESCE(prep."rate", CASE WHEN (o."roleRates"->>'TECHNICIAN') ~ '^[0-9]+(\.[0-9]+)?$' THEN (o."roleRates"->>'TECHNICIAN')::numeric END, 0)::float8)
  AS "prices"
FROM "WorkOrder" w2
JOIN "Organization" o ON o."id" = w2."organizationId"
LEFT JOIN "ServiceContract" c ON c."id" = w2."contractId"
-- Preparation rate (lib/prep-time.ts prepRateFor): the highest among the assigned technicians, each at the role they
-- take on the job (workOrderRateFor in lib/roles.ts), the Super Admin and former members left out; else the Technician rate.
LEFT JOIN LATERAL (
  SELECT MAX(CASE
    WHEN jr."id" IS NOT NULL THEN CASE WHEN jr."access"::text IN ('OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN')
      THEN COALESCE(jr."hourlyRate", CASE WHEN (o."roleRates"->>(jr."access"::text)) ~ '^[0-9]+(\.[0-9]+)?$' THEN (o."roleRates"->>(jr."access"::text))::numeric END, m."hourlyRate") END
    WHEN a."role" IS NOT NULL THEN CASE WHEN a."role"::text IN ('OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN')
      THEN COALESCE(CASE WHEN (o."roleRates"->>(a."role"::text)) ~ '^[0-9]+(\.[0-9]+)?$' THEN (o."roleRates"->>(a."role"::text))::numeric END, m."hourlyRate") END
    ELSE CASE WHEN m."role"::text IN ('OWNER', 'ADMIN', 'MANAGER', 'TECHNICIAN')
      THEN COALESCE(mjr."hourlyRate", CASE WHEN (o."roleRates"->>(m."role"::text)) ~ '^[0-9]+(\.[0-9]+)?$' THEN (o."roleRates"->>(m."role"::text))::numeric END, m."hourlyRate") END
  END) AS "rate"
  FROM "WorkOrderAssignee" a
  JOIN "Membership" m ON m."userId" = a."userId" AND m."organizationId" = w2."organizationId" AND m."active" AND m."role" <> 'OWNER'
  LEFT JOIN "JobRole" jr ON jr."id" = a."jobRoleId"
  LEFT JOIN "JobRole" mjr ON mjr."id" = m."jobRoleId"
  WHERE a."workOrderId" = w2."id"
) prep ON true
WHERE w2."status" = 'DONE'
) p
WHERE p."id" = w."id";

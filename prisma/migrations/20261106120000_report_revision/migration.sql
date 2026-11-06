-- The service report's revision: raised when a completed job's report content changes.
ALTER TABLE "WorkOrder" ADD COLUMN "reportRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "reportFingerprint" TEXT;

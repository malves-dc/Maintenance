-- CreateTable
CREATE TABLE "ReportSend" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportSend_workOrderId_email_idx" ON "ReportSend"("workOrderId", "email");

-- AddForeignKey
ALTER TABLE "ReportSend" ADD CONSTRAINT "ReportSend_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reports already sent: each address of the last send, on that day (earlier sends weren't kept per address).
INSERT INTO "ReportSend" ("id", "workOrderId", "email", "sentAt")
SELECT 'rs' || md5(w."id" || '/' || a.email), w."id", lower(a.email), w."reportSentAt"
FROM "WorkOrder" w, unnest(w."reportSentTo") AS a(email)
WHERE w."reportSentAt" IS NOT NULL;

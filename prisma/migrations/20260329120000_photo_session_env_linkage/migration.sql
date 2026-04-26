-- AlterTable
ALTER TABLE "PhotoSession" ADD COLUMN "environmentSnapshotId" TEXT;
ALTER TABLE "PhotoSession" ADD COLUMN "session_context_json" TEXT;

-- CreateIndex
CREATE INDEX "PhotoSession_environmentSnapshotId_idx" ON "PhotoSession"("environmentSnapshotId");

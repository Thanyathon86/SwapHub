-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'LISTING_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE 'LISTING_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'CATALOG_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'TICKET_CLOSED';

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "targetUserId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

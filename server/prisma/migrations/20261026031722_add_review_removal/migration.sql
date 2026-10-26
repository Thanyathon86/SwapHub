-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'REVIEW_REMOVED';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "detail" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "removeReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedById" UUID;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

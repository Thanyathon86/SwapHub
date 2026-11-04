-- CreateEnum
CREATE TYPE "EscrowStatus" AS ENUM ('AWAITING_PAYMENT', 'HELD', 'SHIPPED', 'DISPUTED', 'RELEASED', 'REFUNDED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EscrowEventType" AS ENUM ('CREATED', 'PAID', 'SHIPPED', 'RECEIVED', 'DISPUTED', 'RELEASED', 'REFUNDED', 'CANCELLED', 'EXPIRED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'ESCROW_RELEASED';
ALTER TYPE "AuditAction" ADD VALUE 'ESCROW_REFUNDED';

-- CreateTable
CREATE TABLE "Escrow" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "twoWay" BOOLEAN NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "paymentDueAt" TIMESTAMP(3) NOT NULL,
    "shipDueAt" TIMESTAMP(3),
    "confirmDueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "paymentRef" TEXT,
    "payoutRef" TEXT,
    "refundRef" TEXT,
    "sellerCarrier" TEXT,
    "sellerTrackingNumber" TEXT,
    "sellerShippedAt" TIMESTAMP(3),
    "buyerCarrier" TEXT,
    "buyerTrackingNumber" TEXT,
    "buyerShippedAt" TIMESTAMP(3),
    "buyerReceivedAt" TIMESTAMP(3),
    "sellerReceivedAt" TIMESTAMP(3),
    "disputedAt" TIMESTAMP(3),
    "disputedById" UUID,
    "disputeReason" TEXT,
    "settledAt" TIMESTAMP(3),
    "resolvedById" UUID,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Escrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscrowEvent" (
    "id" UUID NOT NULL,
    "escrowId" UUID NOT NULL,
    "type" "EscrowEventType" NOT NULL,
    "actorId" UUID,
    "status" "EscrowStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EscrowEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Escrow_offerId_key" ON "Escrow"("offerId");

-- CreateIndex
CREATE INDEX "Escrow_status_updatedAt_idx" ON "Escrow"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Escrow_buyerId_status_idx" ON "Escrow"("buyerId", "status");

-- CreateIndex
CREATE INDEX "Escrow_sellerId_status_idx" ON "Escrow"("sellerId", "status");

-- CreateIndex
CREATE INDEX "EscrowEvent_escrowId_createdAt_idx" ON "EscrowEvent"("escrowId", "createdAt");

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_disputedById_fkey" FOREIGN KEY ("disputedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Escrow" ADD CONSTRAINT "Escrow_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEvent" ADD CONSTRAINT "EscrowEvent_escrowId_fkey" FOREIGN KEY ("escrowId") REFERENCES "Escrow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscrowEvent" ADD CONSTRAINT "EscrowEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

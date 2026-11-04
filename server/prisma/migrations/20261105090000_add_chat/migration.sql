-- CreateTable
CREATE TABLE "Conversation" (
    "id" UUID NOT NULL,
    "listingId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "sellerId" UUID NOT NULL,
    "lastMessageAt" TIMESTAMP(3),
    "buyerLastReadAt" TIMESTAMP(3),
    "sellerLastReadAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT,
    "imageKey" TEXT,
    "imageWidth" INTEGER,
    "imageHeight" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatBlock" (
    "blockerId" UUID NOT NULL,
    "blockedId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatBlock_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateIndex
CREATE INDEX "Conversation_buyerId_lastMessageAt_idx" ON "Conversation"("buyerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_sellerId_lastMessageAt_idx" ON "Conversation"("sellerId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_listingId_buyerId_key" ON "Conversation"("listingId", "buyerId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_imageKey_key" ON "ChatMessage"("imageKey");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatBlock_blockedId_idx" ON "ChatBlock"("blockedId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatBlock" ADD CONSTRAINT "ChatBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ย้ายแชทเดิมจาก OfferMessage ข้อเสนอของคู่เดียวกันในประกาศเดียวกันรวมเป็นห้องเดียว
-- ตั้งว่าอ่านแล้วทั้งหมด ไม่งั้นทุกคนจะเห็นข้อความเก่าเป็นข้อความใหม่ตอนเปิดใช้งาน
INSERT INTO "Conversation" ("id", "listingId", "buyerId", "sellerId", "lastMessageAt", "buyerLastReadAt", "sellerLastReadAt", "createdAt")
SELECT gen_random_uuid(), o."listingId", o."buyerId", l."sellerId", max(m."createdAt"), max(m."createdAt"), max(m."createdAt"), min(m."createdAt")
FROM "OfferMessage" m
JOIN "Offer" o ON o."id" = m."offerId"
JOIN "Listing" l ON l."id" = o."listingId"
GROUP BY o."listingId", o."buyerId", l."sellerId";

INSERT INTO "ChatMessage" ("id", "conversationId", "authorId", "body", "createdAt")
SELECT m."id", c."id", m."authorId", m."body", m."createdAt"
FROM "OfferMessage" m
JOIN "Offer" o ON o."id" = m."offerId"
JOIN "Conversation" c ON c."listingId" = o."listingId" AND c."buyerId" = o."buyerId";

-- DropForeignKey
ALTER TABLE "OfferMessage" DROP CONSTRAINT "OfferMessage_authorId_fkey";

-- DropForeignKey
ALTER TABLE "OfferMessage" DROP CONSTRAINT "OfferMessage_offerId_fkey";

-- DropTable
DROP TABLE "OfferMessage";

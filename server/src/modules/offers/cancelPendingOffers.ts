import type { Prisma } from '../../generated/prisma/client.js'

// แยกไฟล์ไว้ให้ listings.service เรียกได้โดยไม่ import วนกับ offers.service
// ยกเลิกทั้ง offer ที่ขอประกาศนี้ และ offer ที่เอาประกาศนี้ไปเป็นของแลก เพราะทั้งคู่ตอบรับไม่ได้แล้ว
export const cancelPendingOffers = (db: Prisma.TransactionClient, listingIds: string[]) =>
  db.offer.updateMany({
    where: {
      status: 'PENDING',
      OR: [{ listingId: { in: listingIds } }, { items: { some: { listingId: { in: listingIds } } } }],
    },
    data: { status: 'CANCELLED', respondedAt: new Date() },
  })

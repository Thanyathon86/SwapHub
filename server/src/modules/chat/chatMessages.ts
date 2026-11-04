import type { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import { readPrivateFile } from '../../lib/storage.js'

// แยกจาก chat.service เพราะ escrow.service ต้องใช้ ถ้า import chat.service จะเกิดวง listings -> reviews -> escrow -> chat -> listings
// ซึ่งทำให้ server เริ่มทำงานไม่ได้ ไฟล์นี้ห้าม import จากโมดูลอื่นที่เป็น service

const ADMIN_MESSAGE_LIMIT = 200

type MessageRow = Prisma.ChatMessageGetPayload<object>

// ไม่ส่ง imageKey ออกไป หน้าเว็บขอรูปผ่าน endpoint ที่ตรวจสิทธิ์ด้วย id ของข้อความ
export const toMessage = (m: MessageRow) => ({
  id: m.id,
  conversationId: m.conversationId,
  authorId: m.authorId,
  body: m.body,
  image: m.imageKey && m.imageWidth && m.imageHeight ? { width: m.imageWidth, height: m.imageHeight } : null,
  createdAt: m.createdAt,
})

// ใช้เฉพาะตอนตัดสินข้อพิพาท escrow ตรวจเงื่อนไขที่ escrow.service
export const listDealMessages = async (listingId: string, buyerId: string) => {
  const rows = await prisma.chatMessage.findMany({
    where: { conversation: { listingId, buyerId } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: ADMIN_MESSAGE_LIMIT,
  })
  return rows.reverse().map(toMessage)
}

export const readDealImage = async (listingId: string, buyerId: string, messageId: string) => {
  const message = await prisma.chatMessage.findFirst({
    where: { id: messageId, imageKey: { not: null }, conversation: { listingId, buyerId } },
    select: { imageKey: true },
  })
  if (!message?.imageKey) throw new AppError(404, 'CHAT_NOT_FOUND', 'Conversation not found')
  return readPrivateFile(message.imageKey)
}

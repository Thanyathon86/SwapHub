import { prisma } from '../../lib/prisma.js'

// นับเฉพาะเรื่องที่ผู้ใช้ต้องทำอะไรต่อ ยังไม่มีระบบ "อ่านแล้ว" จึงไม่นับสิ่งที่แค่เปลี่ยนสถานะ
export const getCounts = async (userId: string) => {
  const [incomingOffers, answeredTickets] = await Promise.all([
    prisma.offer.count({ where: { status: 'PENDING', listing: { sellerId: userId } } }),
    prisma.supportTicket.count({ where: { userId, status: 'ANSWERED' } }),
  ])
  return { incomingOffers, answeredTickets }
}

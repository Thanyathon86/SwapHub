import type { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import type { AdminTicketsQuery, CreateTicketInput } from './support.schema.js'

// กันผู้ใช้คนเดียวเปิดเรื่องรัว ๆ จนคิวทีมงานเต็ม
const MAX_OPEN_TICKETS = 5
const PAGE_SIZE = 20
const LIST_LIMIT = 100

const ticketFields = {
  id: true,
  subject: true,
  category: true,
  status: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SupportTicketSelect

// ฝั่งผู้ใช้ไม่ส่ง authorId หรือ assignee ออกไป ไม่ให้รู้ว่า admin คนไหนตอบ (หน้าเว็บแสดงเป็น "ทีมงาน")
const userTicketSelect = {
  ...ticketFields,
  messages: { select: { id: true, body: true, fromStaff: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.SupportTicketSelect

const adminTicketInclude = {
  user: { select: { id: true, displayName: true, email: true, status: true } },
  assignee: { select: { id: true, displayName: true } },
} satisfies Prisma.SupportTicketInclude

const adminTicketDetailInclude = {
  ...adminTicketInclude,
  messages: {
    select: { id: true, body: true, fromStaff: true, createdAt: true, author: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.SupportTicketInclude

const notFound = () => new AppError(404, 'TICKET_NOT_FOUND', 'Ticket not found')
const closed = () => new AppError(409, 'TICKET_CLOSED', 'Ticket is closed')
const notClosed = { not: 'CLOSED' } as const

// owner ว่างแปลว่า admin ซึ่งเข้าถึงได้ทุกเรื่อง ส่วนผู้ใช้เห็นเฉพาะของตัวเอง (ของคนอื่นตอบ 404 เหมือนไม่มีอยู่)
const scope = (id: string, userId?: string): Prisma.SupportTicketWhereInput => ({ id, ...(userId && { userId }) })

// เช็ก status ใน where เดียวกับ update กันสองฝ่ายกดพร้อมกัน เช่น ผู้ใช้ปิดเรื่องตอนที่ admin กำลังตอบ
const updateOpenTicket = async (
  db: Prisma.TransactionClient,
  where: Prisma.SupportTicketWhereInput,
  data: Prisma.SupportTicketUncheckedUpdateManyInput,
) => {
  const { count } = await db.supportTicket.updateMany({ where: { ...where, status: notClosed }, data })
  if (count === 0) {
    if (!(await db.supportTicket.count({ where }))) throw notFound()
    throw closed()
  }
}

// ---------- ผู้ใช้ ----------

export const createTicket = async (userId: string, { subject, category, body }: CreateTicketInput) => {
  const open = await prisma.supportTicket.count({ where: { userId, status: notClosed } })
  if (open >= MAX_OPEN_TICKETS) {
    throw new AppError(409, 'TOO_MANY_OPEN_TICKETS', `You can have at most ${MAX_OPEN_TICKETS} open tickets`)
  }
  return prisma.supportTicket.create({
    data: { userId, subject, category, messages: { create: { authorId: userId, body, fromStaff: false } } },
    select: userTicketSelect,
  })
}

export const listMyTickets = (userId: string) =>
  prisma.supportTicket.findMany({
    where: { userId },
    select: ticketFields,
    orderBy: { updatedAt: 'desc' },
    take: LIST_LIMIT,
  })

export const getMyTicket = async (userId: string, id: string) => {
  const ticket = await prisma.supportTicket.findFirst({ where: scope(id, userId), select: userTicketSelect })
  if (!ticket) throw notFound()
  return ticket
}

export const addUserMessage = (userId: string, id: string, body: string) =>
  prisma.$transaction(async (tx) => {
    // ผู้ใช้ตอบกลับแล้วเรื่องกลับไปอยู่ในคิวรอทีมงาน
    await updateOpenTicket(tx, scope(id, userId), { status: 'OPEN' })
    await tx.supportMessage.create({ data: { ticketId: id, authorId: userId, body, fromStaff: false } })
    return tx.supportTicket.findUniqueOrThrow({ where: { id }, select: userTicketSelect })
  })

export const closeMyTicket = async (userId: string, id: string) => {
  await updateOpenTicket(prisma, scope(id, userId), { status: 'CLOSED', closedAt: new Date() })
  return getMyTicket(userId, id)
}

// ---------- admin ----------

export const listTickets = async ({ status, category, page }: AdminTicketsQuery) => {
  const where: Prisma.SupportTicketWhereInput = { status, ...(category && { category }) }
  const [tickets, total] = await prisma.$transaction([
    prisma.supportTicket.findMany({
      where,
      include: { ...adminTicketInclude, _count: { select: { messages: true } } },
      // เรื่องที่รอทีมงานให้อันที่รอนานสุดขึ้นก่อน สถานะอื่นดูอันล่าสุดก่อน
      orderBy: { updatedAt: status === 'OPEN' ? 'asc' : 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.supportTicket.count({ where }),
  ])
  return { tickets, total, page, pageSize: PAGE_SIZE }
}

export const getTicket = async (id: string) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, include: adminTicketDetailInclude })
  if (!ticket) throw notFound()
  return ticket
}

export const addStaffMessage = async (adminId: string, id: string, body: string) => {
  await prisma.$transaction(async (tx) => {
    await updateOpenTicket(tx, scope(id), { status: 'ANSWERED' })
    // คนที่ตอบเรื่องที่ยังไม่มีใครรับ ถือว่ารับเรื่องไปเลย ไม่ทับคนที่รับไว้ก่อน
    await tx.supportTicket.updateMany({ where: { id, assigneeId: null }, data: { assigneeId: adminId } })
    await tx.supportMessage.create({ data: { ticketId: id, authorId: adminId, body, fromStaff: true } })
  })
  return getTicket(id)
}

export const assignTicket = async (adminId: string, id: string) => {
  await updateOpenTicket(prisma, scope(id), { assigneeId: adminId })
  return getTicket(id)
}

export const closeTicket = async (id: string) => {
  await updateOpenTicket(prisma, scope(id), { status: 'CLOSED', closedAt: new Date() })
  return getTicket(id)
}

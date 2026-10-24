import { api } from '@shared/lib/api'
import type { Ticket, TicketCategory, TicketMessage, TicketStatus } from '@shared/support/types'

export type TicketDetail = Ticket & { messages: TicketMessage[] }

type TicketResponse = { ticket: TicketDetail }

export const supportApi = {
  list: () => api<{ tickets: Ticket[] }>('/support/tickets').then((r) => r.tickets),
  get: (id: string) => api<TicketResponse>(`/support/tickets/${id}`).then((r) => r.ticket),
  create: (input: { subject: string; category: TicketCategory; body: string }) =>
    api<TicketResponse>('/support/tickets', { method: 'POST', body: input }).then((r) => r.ticket),
  reply: (id: string, body: string) =>
    api<TicketResponse>(`/support/tickets/${id}/messages`, { method: 'POST', body: { body } }).then((r) => r.ticket),
  close: (id: string) => api<TicketResponse>(`/support/tickets/${id}/close`, { method: 'POST' }).then((r) => r.ticket),
}

// คำจากมุมผู้ใช้ ANSWERED คือมีคำตอบรออ่าน จึงเด่นกว่าสถานะอื่น
export const ticketStatusLabel: Record<TicketStatus, { text: string; className: string }> = {
  OPEN: { text: 'รอทีมงานตอบ', className: 'bg-zinc-100 text-zinc-600 ring-zinc-200' },
  ANSWERED: { text: 'ทีมงานตอบแล้ว', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  CLOSED: { text: 'ปิดแล้ว', className: 'bg-zinc-50 text-zinc-400 ring-zinc-200' },
}

// ชื่อกลางของทีมงาน ไม่เปิดเผยว่า admin คนไหนตอบ
export const STAFF_NAME = 'ทีมงาน SwapHub'

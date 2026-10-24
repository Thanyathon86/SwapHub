export type TicketCategory = 'ACCOUNT' | 'LISTING' | 'OFFER' | 'BUG' | 'OTHER'
export type TicketStatus = 'OPEN' | 'ANSWERED' | 'CLOSED'

export type Ticket = {
  id: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  closedAt: string | null
  createdAt: string
  updatedAt: string
}

// ฝั่งผู้ใช้ไม่มีข้อมูลผู้เขียน ฝั่ง admin มี author เพิ่มมา
export type TicketMessage = {
  id: string
  body: string
  fromStaff: boolean
  createdAt: string
  author?: { id: string; displayName: string }
}

export const ticketCategoryLabel: Record<TicketCategory, string> = {
  ACCOUNT: 'บัญชีผู้ใช้',
  LISTING: 'ประกาศ',
  OFFER: 'ข้อเสนอซื้อ/แลก',
  BUG: 'ระบบมีปัญหา',
  OTHER: 'อื่น ๆ',
}

export const ticketCategories = Object.keys(ticketCategoryLabel) as TicketCategory[]

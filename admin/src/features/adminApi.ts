import { api } from '@shared/lib/api'
import type { Role } from '@shared/auth/authApi'
import type { Listing, ListingStatus } from '@shared/listings/listingsApi'
import type { Ticket, TicketCategory, TicketMessage, TicketStatus } from '@shared/support/types'

// admin เห็นอีเมลผู้ขายและผู้ที่ตรวจประกาศ ซึ่งหน้า public ไม่ได้รับ
export type AdminListing = Listing & {
  seller: Listing['seller'] & { email: string }
  reviewedBy: { id: string; displayName: string } | null
}
export type AdminListingsQuery = { status: ListingStatus; page: number }
export type AdminListingsPage = { listings: AdminListing[]; total: number; page: number; pageSize: number }
export type ListingReview = { decision: 'APPROVE' } | { decision: 'REJECT'; reason: string }

type CatalogItem = {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count: { listings: number }
}

export type Game = CatalogItem & { slug: string; imageKey: string | null }
export type GradingCompany = CatalogItem

export type GameInput = { name: string; slug: string; isActive?: boolean }
export type GradingCompanyInput = { name: string; isActive?: boolean }

export type UserStatus = 'ACTIVE' | 'SUSPENDED'

export type AdminUser = {
  id: string
  email: string
  displayName: string
  username: string
  role: Role
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
}

export type UsersQuery = { q?: string; status?: UserStatus; role?: Role; page: number }
export type UsersPage = { users: AdminUser[]; total: number; page: number; pageSize: number }

export type AuditAction =
  | 'USER_PROMOTED'
  | 'USER_DEMOTED'
  | 'USER_SUSPENDED'
  | 'USER_REACTIVATED'
  | 'REVIEW_REMOVED'
  | 'LISTING_APPROVED'
  | 'LISTING_REJECTED'
  | 'CATALOG_CHANGED'
  | 'TICKET_CLOSED'
  | 'ESCROW_RELEASED'
  | 'ESCROW_REFUNDED'

type AuditParty = { id: string; displayName: string; email: string }

export type AuditLog = {
  id: string
  action: AuditAction
  detail: string | null
  createdAt: string
  actor: AuditParty
  // null เมื่อไม่ได้เจาะจงผู้ใช้คนเดียว เช่น แก้ข้อมูลเกม ดูรายละเอียดจาก detail
  targetUser: AuditParty | null
}

export type AuditLogsPage = { logs: AuditLog[]; total: number; page: number; pageSize: number }

type ReviewParty = { id: string; username: string; displayName: string; email: string }

export type AdminReview = {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  removedAt: string | null
  removeReason: string | null
  removedBy: { id: string; displayName: string } | null
  reviewer: ReviewParty
  reviewee: ReviewParty
  offer: { id: string; listing: { id: string; title: string } }
}
export type ReviewStatus = 'VISIBLE' | 'REMOVED'
export type ReviewsQuery = { q?: string; status: ReviewStatus; page: number }
export type ReviewsPage = { reviews: AdminReview[]; total: number; page: number; pageSize: number }

export type AdminCounts = { pendingListings: number; openTickets: number; openDisputes: number }

export type DailyPoint = { day: string; users: number; listings: number; deals: number }

export type Dashboard = {
  attention: { pendingListings: number; pendingListingsOver24h: number; pendingOffers: number; openTickets: number; openDisputes: number }
  totals: { users: number; newUsers7d: number; suspendedUsers: number; activeListings: number; deals7d: number; escrowHolding: string }
  daily: DailyPoint[]
  listingsByGame: { id: string; name: string; isActive: boolean; activeListings: number }[]
  security24h: { loginFailed: number; rateLimited: number; accessDenied: number; serverErrors: number }
  recentAudit: (Omit<AuditLog, 'actor' | 'targetUser'> & {
    actor: { id: string; displayName: string }
    targetUser: { id: string; displayName: string } | null
  })[]
}

export type EventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'REGISTER'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET'
  | 'RATE_LIMITED'
  | 'ACCESS_DENIED'
  | 'SERVER_ERROR'

export type EventLog = {
  id: string
  type: EventType
  userId: string | null
  user: AuditParty | null
  email: string | null
  ip: string | null
  userAgent: string | null
  method: string | null
  path: string | null
  statusCode: number | null
  detail: string | null
  createdAt: string
}

export type EventsPage = { events: EventLog[]; total: number; page: number; pageSize: number }

// admin เห็นอีเมลผู้แจ้งและ admin ที่รับเรื่อง ซึ่งฝั่งผู้ใช้ไม่ได้รับ
export type AdminTicket = Ticket & {
  user: { id: string; displayName: string; email: string; status: UserStatus }
  assignee: { id: string; displayName: string } | null
}
export type AdminTicketListItem = AdminTicket & { _count: { messages: number } }
export type AdminTicketDetail = AdminTicket & { messages: Required<TicketMessage>[] }
export type TicketsQuery = { status: TicketStatus; category?: TicketCategory; page: number }
export type TicketsPage = { tickets: AdminTicketListItem[]; total: number; page: number; pageSize: number }

export type EscrowStatus = 'DISPUTED' | 'AWAITING_PAYMENT' | 'HELD' | 'SHIPPED' | 'RELEASED' | 'REFUNDED' | 'CANCELLED' | 'EXPIRED'
export type EscrowEventType = 'CREATED' | 'PAID' | 'SHIPPED' | 'RECEIVED' | 'DISPUTED' | 'RELEASED' | 'REFUNDED' | 'CANCELLED' | 'EXPIRED'
export type EscrowParty = { id: string; displayName: string; username: string; email: string; status: UserStatus }

export type AdminEscrow = {
  id: string
  amount: string
  status: EscrowStatus
  updatedAt: string
  buyer: EscrowParty
  seller: EscrowParty
  offer: { listing: { id: string; title: string } }
}
export type EscrowsPage = {
  escrows: AdminEscrow[]
  total: number
  page: number
  pageSize: number
  holding: { count: number; amount: string }
}

type StaffName = { id: string; displayName: string }

export type AdminEscrowDetail = Omit<AdminEscrow, 'offer'> & {
  buyerId: string
  sellerId: string
  twoWay: boolean
  paymentDueAt: string
  shipDueAt: string | null
  confirmDueAt: string | null
  paidAt: string | null
  paymentRef: string | null
  payoutRef: string | null
  refundRef: string | null
  sellerCarrier: string | null
  sellerTrackingNumber: string | null
  sellerShippedAt: string | null
  buyerCarrier: string | null
  buyerTrackingNumber: string | null
  buyerShippedAt: string | null
  buyerReceivedAt: string | null
  sellerReceivedAt: string | null
  disputedAt: string | null
  disputeReason: string | null
  disputedBy: StaffName | null
  settledAt: string | null
  resolutionNote: string | null
  resolvedBy: StaffName | null
  events: { id: string; type: EscrowEventType; note: string | null; createdAt: string; actor: StaffName | null }[]
  offer: {
    id: string
    quantity: number
    message: string | null
    listing: { id: string; title: string }
    items: { quantity: number; listing: { id: string; title: string } }[]
  }
  // ว่างเมื่อดีลไม่เคยมีข้อพิพาท แชทเป็นเรื่องส่วนตัวของคู่ดีล
  messages: { id: string; authorId: string; body: string | null; image: { width: number; height: number } | null; createdAt: string }[]
}

type TicketResponse = { ticket: AdminTicketDetail }
const ticketAction = (id: string, action: 'assign' | 'close') =>
  api<TicketResponse>(`/admin/support/tickets/${id}/${action}`, { method: 'POST' }).then((r) => r.ticket)

const usersQueryString = ({ q, status, role, page }: UsersQuery) => {
  const params = new URLSearchParams({ page: String(page) })
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  if (role) params.set('role', role)
  return params.toString()
}

export const adminApi = {
  dashboard: () => api<Dashboard>('/admin/dashboard'),
  counts: () => api<AdminCounts>('/admin/counts'),
  listTickets: ({ status, category, page }: TicketsQuery) =>
    api<TicketsPage>(
      `/admin/support/tickets?${new URLSearchParams({ status, page: String(page), ...(category && { category }) })}`,
    ),
  getTicket: (id: string) => api<TicketResponse>(`/admin/support/tickets/${id}`).then((r) => r.ticket),
  replyTicket: (id: string, body: string) =>
    api<TicketResponse>(`/admin/support/tickets/${id}/messages`, { method: 'POST', body: { body } }).then((r) => r.ticket),
  assignTicket: (id: string) => ticketAction(id, 'assign'),
  closeTicket: (id: string) => ticketAction(id, 'close'),
  listEvents: (type: EventType | undefined, page: number) =>
    api<EventsPage>(`/admin/events?${new URLSearchParams({ page: String(page), ...(type && { type }) })}`),

  listGames: () => api<{ games: Game[] }>('/admin/games').then((r) => r.games),
  createGame: (input: GameInput) => api<{ game: Game }>('/admin/games', { method: 'POST', body: input }),
  updateGame: (id: string, input: Partial<GameInput>) =>
    api<{ game: Game }>(`/admin/games/${id}`, { method: 'PATCH', body: input }),
  uploadGameImage: (id: string, image: Blob) => {
    const form = new FormData()
    form.append('image', image, 'game.jpg')
    return api<{ game: Game }>(`/admin/games/${id}/image`, { method: 'POST', body: form })
  },
  removeGameImage: (id: string) => api<{ game: Game }>(`/admin/games/${id}/image`, { method: 'DELETE' }),

  listGradingCompanies: () =>
    api<{ gradingCompanies: GradingCompany[] }>('/admin/grading-companies').then((r) => r.gradingCompanies),
  createGradingCompany: (input: GradingCompanyInput) =>
    api<{ gradingCompany: GradingCompany }>('/admin/grading-companies', { method: 'POST', body: input }),
  updateGradingCompany: (id: string, input: Partial<GradingCompanyInput>) =>
    api<{ gradingCompany: GradingCompany }>(`/admin/grading-companies/${id}`, { method: 'PATCH', body: input }),

  listUsers: (query: UsersQuery) => api<UsersPage>(`/admin/users?${usersQueryString(query)}`),
  setUserStatus: (id: string, status: UserStatus) =>
    api<{ user: AdminUser }>(`/admin/users/${id}/status`, { method: 'PATCH', body: { status } }),
  setUserRole: (id: string, role: Role) =>
    api<{ user: AdminUser }>(`/admin/users/${id}/role`, { method: 'PATCH', body: { role } }),
  listAuditLogs: (action: AuditAction | undefined, page: number) =>
    api<AuditLogsPage>(`/admin/audit-logs?${new URLSearchParams({ page: String(page), ...(action && { action }) })}`),

  escrowImageUrl: (id: string, messageId: string) => `/api/admin/escrows/${id}/messages/${messageId}/image`,
  listEscrows: (status: EscrowStatus, page: number) =>
    api<EscrowsPage>(`/admin/escrows?${new URLSearchParams({ status, page: String(page) })}`),
  getEscrow: (id: string) => api<{ escrow: AdminEscrowDetail }>(`/admin/escrows/${id}`).then((r) => r.escrow),
  resolveEscrow: (id: string, decision: 'RELEASE' | 'REFUND', reason: string) =>
    api<{ escrow: AdminEscrowDetail }>(`/admin/escrows/${id}/resolve`, { method: 'POST', body: { decision, reason } }).then((r) => r.escrow),

  listReviews: ({ q, status, page }: ReviewsQuery) =>
    api<ReviewsPage>(`/admin/reviews?${new URLSearchParams({ status, page: String(page), ...(q && { q }) })}`),
  removeReview: (id: string, reason: string) =>
    api<{ review: AdminReview }>(`/admin/reviews/${id}/remove`, { method: 'POST', body: { reason } }),

  listListings: ({ status, page }: AdminListingsQuery) =>
    api<AdminListingsPage>(`/admin/listings?${new URLSearchParams({ status, page: String(page) }).toString()}`),
  reviewListing: (id: string, review: ListingReview) =>
    api<{ listing: AdminListing }>(`/admin/listings/${id}/review`, { method: 'PATCH', body: review }),
}

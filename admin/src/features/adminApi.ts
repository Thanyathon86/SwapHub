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

export type Game = CatalogItem & { slug: string }
export type GradingCompany = CatalogItem

export type GameInput = { name: string; slug: string; isActive?: boolean }
export type GradingCompanyInput = { name: string; isActive?: boolean }

export type UserStatus = 'ACTIVE' | 'SUSPENDED'

export type AdminUser = {
  id: string
  email: string
  displayName: string
  role: Role
  status: UserStatus
  lastLoginAt: string | null
  createdAt: string
}

export type UsersQuery = { q?: string; status?: UserStatus; role?: Role; page: number }
export type UsersPage = { users: AdminUser[]; total: number; page: number; pageSize: number }

export type AuditAction = 'USER_PROMOTED' | 'USER_DEMOTED' | 'USER_SUSPENDED' | 'USER_REACTIVATED'

type AuditParty = { id: string; displayName: string; email: string }

export type AuditLog = {
  id: string
  action: AuditAction
  createdAt: string
  actor: AuditParty
  targetUser: AuditParty
}

export type AuditLogsPage = { logs: AuditLog[]; total: number; page: number; pageSize: number }

export type DailyPoint = { day: string; users: number; listings: number; deals: number }

export type Dashboard = {
  attention: { pendingListings: number; pendingListingsOver24h: number; pendingOffers: number; openTickets: number }
  totals: { users: number; newUsers7d: number; suspendedUsers: number; activeListings: number; deals7d: number }
  daily: DailyPoint[]
  listingsByGame: { id: string; name: string; isActive: boolean; activeListings: number }[]
  security24h: { loginFailed: number; rateLimited: number; accessDenied: number; serverErrors: number }
  recentAudit: (Omit<AuditLog, 'actor' | 'targetUser'> & {
    actor: { id: string; displayName: string }
    targetUser: { id: string; displayName: string }
  })[]
}

export type EventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'REGISTER'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
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
  listAuditLogs: (page: number) => api<AuditLogsPage>(`/admin/audit-logs?page=${page}`),

  listListings: ({ status, page }: AdminListingsQuery) =>
    api<AdminListingsPage>(`/admin/listings?${new URLSearchParams({ status, page: String(page) }).toString()}`),
  reviewListing: (id: string, review: ListingReview) =>
    api<{ listing: AdminListing }>(`/admin/listings/${id}/review`, { method: 'PATCH', body: review }),
}

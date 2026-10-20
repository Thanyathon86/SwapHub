import { api } from '../../lib/api'
import type { Role } from '../auth/authApi'

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

export type UsersQuery = { q?: string; status?: UserStatus; page: number }
export type UsersPage = { users: AdminUser[]; total: number; page: number; pageSize: number }

export type AdminStats = {
  users: number
  suspendedUsers: number
  activeGames: number
  pendingListings: number
  activeListings: number
}

const usersQueryString = ({ q, status, page }: UsersQuery) => {
  const params = new URLSearchParams({ page: String(page) })
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  return params.toString()
}

export const adminApi = {
  stats: () => api<{ stats: AdminStats }>('/admin/stats').then((r) => r.stats),

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
}

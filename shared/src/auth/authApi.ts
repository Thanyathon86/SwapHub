import { api } from '../lib/api'

export type Role = 'USER' | 'ADMIN'

export type AuthUser = {
  id: string
  email: string
  displayName: string
  username: string
  avatarKey: string | null
  role: Role
}

type UserResponse = { user: AuthUser }

export type LoginInput = { email: string; password: string }
export type RegisterInput = LoginInput & { displayName: string }

export const authApi = {
  me: () => api<UserResponse>('/auth/me'),
  login: (input: LoginInput) => api<UserResponse>('/auth/login', { method: 'POST', body: input }),
  adminLogin: (input: LoginInput) => api<UserResponse>('/auth/admin/login', { method: 'POST', body: input }),
  register: (input: RegisterInput) => api<UserResponse>('/auth/register', { method: 'POST', body: input }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  logoutAll: () => api<void>('/auth/logout-all', { method: 'POST' }),
  forgotPassword: (email: string) => api<void>('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (input: { token: string; newPassword: string }) =>
    api<void>('/auth/reset-password', { method: 'POST', body: input }),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    api<void>('/auth/change-password', { method: 'POST', body: input }),
}

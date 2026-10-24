import { createContext } from 'react'
import type { AuthUser, LoginInput, RegisterInput } from './authApi'

export type AuthContextValue = {
  user: AuthUser | null
  // loading = ยังไม่รู้ว่า login อยู่ไหม ห้าม redirect ระหว่างนี้ ไม่งั้นรีเฟรชหน้าแล้วจะโดนเด้งไป login ทุกครั้ง
  status: 'loading' | 'ready'
  login: (input: LoginInput) => Promise<AuthUser>
  adminLogin: (input: LoginInput) => Promise<AuthUser>
  register: (input: RegisterInput) => Promise<AuthUser>
  logout: () => Promise<void>
  logoutAll: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

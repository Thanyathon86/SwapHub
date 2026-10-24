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
  // หลังแก้โปรไฟล์หรือเปลี่ยนรูป ให้เมนูด้านบนเปลี่ยนตามทันทีโดยไม่ต้องโหลด /auth/me ใหม่
  updateUser: (user: AuthUser) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

import type { AuthUser } from './authApi'

// รับเฉพาะ path ภายในเว็บ กัน open redirect ถ้ามีคนยัด URL ภายนอกมาใน state
export const safeRedirect = (from: unknown, user: AuthUser) => {
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from
  return user.role === 'ADMIN' ? '/admin' : '/'
}

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { UNAUTHORIZED_EVENT } from '../lib/api'
import { authApi, type AuthUser, type LoginInput, type RegisterInput } from './authApi'
import { AuthContext, type AuthContextValue } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')

  useEffect(() => {
    let active = true
    authApi
      .me()
      .then(({ user }) => active && setUser(user))
      .catch(() => active && setUser(null))
      .finally(() => active && setStatus('ready'))

    const onUnauthorized = () => setUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => {
      active = false
      window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const { user } = await authApi.login(input)
    setUser(user)
    return user
  }, [])

  const adminLogin = useCallback(async (input: LoginInput) => {
    const { user } = await authApi.adminLogin(input)
    setUser(user)
    return user
  }, [])

  const register = useCallback(async (input: RegisterInput) => {
    const { user } = await authApi.register(input)
    setUser(user)
    return user
  }, [])

  // ล้างสถานะฝั่ง client เสมอแม้ request ล้มเหลว ผู้ใช้กดออกแล้วต้องไม่เห็นตัวเองยัง login อยู่
  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  const logoutAll = useCallback(async () => {
    await authApi.logoutAll()
    setUser(null)
  }, [])

  const value = useMemo(
    // setUser จาก useState มี identity คงที่ ใส่ตรง ๆ ได้เลย
    () => ({ user, status, login, adminLogin, register, logout, logoutAll, updateUser: setUser }),
    [user, status, login, adminLogin, register, logout, logoutAll],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

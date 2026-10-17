import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../features/auth/useAuth'

// ต้องอยู่ใต้ RequireAuth ส่วนสิทธิ์จริงตรวจโดย requireRole('ADMIN') ที่ server
export function RequireAdmin() {
  const { user } = useAuth()
  if (user?.role !== 'ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}

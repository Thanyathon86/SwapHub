import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'

// ต้องอยู่ใต้ RequireAuth ส่วนสิทธิ์จริงตรวจโดย requireRole('ADMIN') ที่ server
// ส่งไปหน้า login ไม่ใช่ / เพราะ / ก็อยู่ใต้ guard นี้ จะวนไม่จบ (เช่น session ของ user ที่แชร์ cookie บน localhost)
export function RequireAdmin() {
  const { user } = useAuth()
  if (user?.role !== 'ADMIN') return <Navigate to="/login" replace />
  return <Outlet />
}

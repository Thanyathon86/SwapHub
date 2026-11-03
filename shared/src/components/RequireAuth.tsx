import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Spinner } from './Spinner'

// guard ฝั่ง client มีไว้เพื่อ UX เท่านั้น สิทธิ์จริงตรวจที่ server ทุก request
export function RequireAuth({ loginPath = '/login' }: { loginPath?: string }) {
  const { user, status } = useAuth()
  const location = useLocation()
  // Outlet ที่ไม่ส่ง context จะทับของ layout ชั้นนอกเป็น undefined หน้าลูกจะอ่านไม่ได้ (เช่น useCounts)
  const context = useOutletContext()

  if (status === 'loading') return <Spinner />
  if (!user) return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />
  return <Outlet context={context} />
}

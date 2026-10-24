import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../features/auth/useAuth'
import { Spinner } from './Spinner'

// guard ฝั่ง client มีไว้เพื่อ UX เท่านั้น สิทธิ์จริงตรวจที่ server ทุก request
export function RequireAuth({ loginPath = '/login' }: { loginPath?: string }) {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <Spinner />
  if (!user) return <Navigate to={loginPath} replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

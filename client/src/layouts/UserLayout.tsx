import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/useAuth'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm ${isActive ? 'font-semibold text-indigo-600' : 'text-slate-600 hover:text-slate-900'}`

// ใช้ร่วมกันทั้งหน้า public และหน้าของ user เพราะ header เหมือนกัน ต่างกันแค่เมนูตามสถานะ login
export function UserLayout() {
  const { user, status, logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold text-slate-800">
            SwapHub
          </Link>
          {status === 'ready' && (
            <nav className="flex items-center gap-4">
              {user ? (
                <>
                  {user.role === 'ADMIN' && (
                    <NavLink to="/admin" className={navClass}>
                      หลังบ้าน
                    </NavLink>
                  )}
                  <NavLink to="/profile" className={navClass}>
                    {user.displayName}
                  </NavLink>
                  <button type="button" onClick={onLogout} className="text-sm text-slate-600 hover:text-slate-900">
                    ออกจากระบบ
                  </button>
                </>
              ) : (
                <>
                  <NavLink to="/login" className={navClass}>
                    เข้าสู่ระบบ
                  </NavLink>
                  <NavLink to="/register" className={navClass}>
                    สมัครสมาชิก
                  </NavLink>
                </>
              )}
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

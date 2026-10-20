import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../features/auth/useAuth'

// เมนูที่ยังไม่มีหน้า ใส่ไว้ให้เห็นโครง เปิด to เมื่อสร้างหน้าแล้ว
const menu: { label: string; to?: string }[] = [
  { label: 'Dashboard', to: '/admin' },
  { label: 'ประกาศรออนุมัติ' },
  { label: 'ผู้ใช้', to: '/admin/users' },
  { label: 'เกมและเกรด', to: '/admin/catalog' },
  { label: 'เรื่องที่แจ้ง' },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-200">
        <div className="px-5 py-4 text-lg font-bold text-white">SwapHub Admin</div>
        <nav className="flex-1 space-y-1 px-3">
          {menu.map((item) =>
            item.to ? (
              <NavLink
                key={item.label}
                to={item.to}
                end
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-700 text-white' : 'hover:bg-slate-800'}`
                }
              >
                {item.label}
              </NavLink>
            ) : (
              <span key={item.label} className="block cursor-not-allowed px-3 py-2 text-sm text-slate-500">
                {item.label} <span className="text-xs">(เร็ว ๆ นี้)</span>
              </span>
            ),
          )}
        </nav>
        <div className="space-y-2 border-t border-slate-700 px-5 py-4 text-sm">
          <div className="truncate text-slate-400">{user?.email}</div>
          <Link to="/" className="block hover:text-white">
            กลับหน้าเว็บ
          </Link>
          <button type="button" onClick={onLogout} className="hover:text-white">
            ออกจากระบบ
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}

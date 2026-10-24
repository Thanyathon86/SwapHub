import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { clientUrl } from '../lib/env'

const menu: { label: string; to: string }[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'ประกาศ', to: '/listings' },
  { label: 'ผู้ใช้', to: '/users' },
  { label: 'เกมและเกรด', to: '/catalog' },
  { label: 'ประวัติการจัดการ', to: '/audit' },
  { label: 'เรื่องที่แจ้ง', to: '/support' },
  { label: 'Log ระบบ', to: '/events' },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-200">
        <div className="px-5 py-4 text-lg font-bold text-white">SwapHub Admin</div>
        <nav className="flex-1 space-y-1 px-3">
          {menu.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              // end เฉพาะ Dashboard ไม่งั้นทุกหน้าจะถือว่าอยู่ใต้ / แต่เมนูอื่นต้องไฮไลต์ตอนอยู่หน้าย่อยด้วย เช่น /support/:id
              end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-700 text-white' : 'hover:bg-slate-800'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-slate-700 px-5 py-4 text-sm">
          <Link to="/account" className="block truncate text-slate-400 hover:text-white" title="บัญชีของฉัน">
            {user?.email}
          </Link>
          <a href={clientUrl} className="block hover:text-white">
            ไปหน้าเว็บ
          </a>
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

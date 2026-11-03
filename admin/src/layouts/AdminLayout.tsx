import { useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { CountBadge } from '@shared/components/CountBadge'
import { usePolling } from '@shared/lib/usePolling'
import { adminApi, type AdminCounts } from '../features/adminApi'
import { clientUrl } from '../lib/env'

const COUNTS_INTERVAL_MS = 60_000

// count บอกว่าเมนูไหนมีงานค้าง ให้เห็นจากทุกหน้าโดยไม่ต้องกลับไปดู Dashboard
const menu: { label: string; to: string; count?: keyof AdminCounts; countLabel?: string }[] = [
  { label: 'Dashboard', to: '/' },
  { label: 'ประกาศ', to: '/listings', count: 'pendingListings', countLabel: 'ประกาศรอตรวจ' },
  { label: 'ผู้ใช้', to: '/users' },
  { label: 'เกมและเกรด', to: '/catalog' },
  { label: 'รีวิว', to: '/reviews' },
  { label: 'ประวัติการจัดการ', to: '/audit' },
  { label: 'เรื่องที่แจ้ง', to: '/support', count: 'openTickets', countLabel: 'เรื่องที่รอตอบ' },
  { label: 'Log ระบบ', to: '/events' },
]

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const counts = usePolling(adminApi.counts, COUNTS_INTERVAL_MS, user !== null)
  const [menuOpen, setMenuOpen] = useState(false)

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <aside className="flex flex-col bg-slate-900 text-slate-200 lg:w-60 lg:shrink-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-4">
          <div className="text-lg font-bold text-white">SwapHub Admin</div>
          {/* จอเล็กพับเมนูไว้ แถบข้างกว้างตายตัวจะกินพื้นที่จนตารางแทบไม่เหลือที่ */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            className="rounded-md px-3 py-1.5 text-sm ring-1 ring-slate-600 hover:bg-slate-800 lg:hidden"
          >
            เมนู
            {/* เมนูพับอยู่ก็ต้องเห็นว่ามีงานค้าง */}
            <CountBadge
              count={counts ? counts.pendingListings + counts.openTickets : undefined}
              label="งานที่รอดำเนินการ"
            />
          </button>
        </div>
        <div id="admin-menu" className={`flex-1 flex-col lg:flex ${menuOpen ? 'flex' : 'hidden'}`}>
          <nav className="flex-1 space-y-1 px-3">
            {menu.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                // end เฉพาะ Dashboard ไม่งั้นทุกหน้าจะถือว่าอยู่ใต้ / แต่เมนูอื่นต้องไฮไลต์ตอนอยู่หน้าย่อยด้วย เช่น /support/:id
                end={item.to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-slate-700 text-white' : 'hover:bg-slate-800'}`
                }
              >
                {item.label}
                {item.count && <CountBadge count={counts?.[item.count]} label={item.countLabel ?? item.label} />}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 space-y-2 border-t border-slate-700 px-5 py-4 text-sm lg:mt-0">
            <Link
              to="/account"
              onClick={() => setMenuOpen(false)}
              className="block truncate text-slate-400 hover:text-white"
              title="บัญชีของฉัน"
            >
              {user?.email}
            </Link>
            <a href={clientUrl} className="block hover:text-white">
              ไปหน้าเว็บ
            </a>
            <button type="button" onClick={onLogout} className="hover:text-white">
              ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>
      {/* min-w-0: ไม่งั้น main จะขยายตามตารางจนหน้าล้น แทนที่ตารางจะเลื่อนในกรอบของตัวเอง */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  )
}

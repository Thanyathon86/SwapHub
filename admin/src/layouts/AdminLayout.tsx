import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { LogoMark } from '@shared/brand/Logo'
import { CountBadge } from '@shared/components/CountBadge'
import { usePolling } from '@shared/lib/usePolling'
import { AdminTopBar } from '../components/AdminTopBar'
import { Icon, type IconName } from '../components/icons'
import { adminApi, type AdminCounts } from '../features/adminApi'
import { clientUrl } from '../lib/env'

const COUNTS_INTERVAL_MS = 60_000

type MenuItem = { label: string; to: string; icon: IconName; count?: keyof AdminCounts; countLabel?: string }

// count บอกว่าเมนูไหนมีงานค้าง ให้เห็นจากทุกหน้าโดยไม่ต้องกลับไปดู Dashboard
const menuGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: 'หลัก',
    items: [
      { label: 'Dashboard', to: '/', icon: 'dashboard' },
      { label: 'ประกาศ', to: '/listings', icon: 'tag', count: 'pendingListings', countLabel: 'ประกาศรอตรวจ' },
      { label: 'ผู้ใช้', to: '/users', icon: 'users' },
      { label: 'เรื่องที่แจ้ง', to: '/support', icon: 'message', count: 'openTickets', countLabel: 'เรื่องที่รอตอบ' },
      { label: 'รีวิว', to: '/reviews', icon: 'star' },
    ],
  },
  {
    title: 'ระบบ',
    items: [
      { label: 'เกมและเกรด', to: '/catalog', icon: 'cards' },
      { label: 'ประวัติการจัดการ', to: '/audit', icon: 'history' },
      { label: 'Log ระบบ', to: '/events', icon: 'terminal' },
    ],
  },
]

const sideRowClass = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm'
const sideRowIdleClass = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'

export function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { key: locationKey } = useLocation()
  const counts = usePolling(adminApi.counts, COUNTS_INTERVAL_MS, user !== null)
  // ผูกกับ location.key แทนการปิดใน onClick ของแต่ละลิงก์ เพราะแถบบนก็พาเปลี่ยนหน้าได้ เปลี่ยนหน้าเมื่อไรเมนูพับเอง
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null)
  const menuOpen = menuOpenAt === locationKey

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="flex flex-col border-b border-slate-200 bg-white lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-4">
          <div className="flex min-w-0 items-center gap-2 text-lg font-bold text-slate-900">
            <LogoMark className="size-8" />
            <span className="truncate">TCGNexus Admin</span>
          </div>
          {/* จอเล็กพับเมนูไว้ แถบข้างกว้างตายตัวจะกินพื้นที่จนตารางแทบไม่เหลือที่ */}
          <button
            type="button"
            onClick={() => setMenuOpenAt(menuOpen ? null : locationKey)}
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 lg:hidden"
          >
            เมนู
            {/* เมนูพับอยู่ก็ต้องเห็นว่ามีงานค้าง */}
            <CountBadge
              count={counts ? counts.pendingListings + counts.openTickets : undefined}
              label="งานที่รอดำเนินการ"
            />
          </button>
        </div>
        <div id="admin-menu" className={`min-h-0 flex-1 flex-col lg:flex ${menuOpen ? 'flex' : 'hidden'}`}>
          {/* จอเตี้ยเมนูยาวเกินความสูงของแถบที่ตรึงไว้ ต้องเลื่อนในกรอบตัวเองได้ */}
          <nav aria-label="เมนูหลังบ้าน" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pt-1 pb-3">
            {menuGroups.map((group) => (
              <div key={group.title} className="space-y-0.5">
                <p className="px-3 pb-1 text-xs font-medium text-slate-500">{group.title}</p>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    // end เฉพาะ Dashboard ไม่งั้นทุกหน้าจะถือว่าอยู่ใต้ / แต่เมนูอื่นต้องไฮไลต์ตอนอยู่หน้าย่อยด้วย เช่น /support/:id
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `${sideRowClass} ${isActive ? 'bg-brand-50 font-medium text-brand-700' : sideRowIdleClass}`
                    }
                  >
                    <Icon name={item.icon} className="size-4.5" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.count && <CountBadge count={counts?.[item.count]} label={item.countLabel ?? item.label} />}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="border-t border-slate-200 p-3">
            <a href={clientUrl} className={`${sideRowClass} ${sideRowIdleClass}`}>
              <Icon name="external" className="size-4.5" />
              ไปหน้าเว็บ
            </a>
          </div>
        </div>
      </aside>
      {/* min-w-0: ไม่งั้นเนื้อหาจะขยายตามตารางจนหน้าล้น แทนที่ตารางจะเลื่อนในกรอบของตัวเอง */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopBar counts={counts} onLogout={onLogout} />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

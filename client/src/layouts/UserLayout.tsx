import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { CountBadge } from '@shared/components/CountBadge'
import { usePolling } from '@shared/lib/usePolling'
import { fetchCounts } from '../features/counts/counts'

const COUNTS_INTERVAL_MS = 60_000

const navClass = ({ isActive }: { isActive: boolean }) =>
  `hidden text-sm transition sm:inline ${isActive ? 'font-medium text-zinc-900' : 'text-zinc-500 hover:text-zinc-900'}`

// ใช้ร่วมกันทั้งหน้า public และหน้าของ user เพราะ header เหมือนกัน ต่างกันแค่เมนูตามสถานะ login
export function UserLayout() {
  const { user, status, logout } = useAuth()
  const navigate = useNavigate()
  const counts = usePolling(fetchCounts, COUNTS_INTERVAL_MS, user !== null)

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="grid size-7 place-items-center rounded-lg bg-zinc-900 text-xs font-bold text-white">S</span>
            SwapHub
          </Link>
          {status === 'ready' && (
            <nav className="flex items-center gap-5">
              {user ? (
                <>
                  <NavLink to="/my-listings" className={navClass}>
                    ประกาศของฉัน
                  </NavLink>
                  <NavLink to="/offers" className={navClass}>
                    ข้อเสนอ
                    <CountBadge count={counts?.incomingOffers} label="ข้อเสนอที่รอตอบ" />
                  </NavLink>
                  <button type="button" onClick={onLogout} className={navClass({ isActive: false })}>
                    ออกจากระบบ
                  </button>
                  <Link to="/sell" className="btn btn-primary">
                    ลงประกาศ
                  </Link>
                  <Link
                    to="/profile"
                    title={user.displayName}
                    className="relative grid size-9 place-items-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700 uppercase hover:bg-zinc-200"
                  >
                    {user.displayName.slice(0, 1)}
                    {/* ทีมงานตอบเรื่องที่แจ้งแล้ว ลิงก์ไปหน้านั้นอยู่ในโปรไฟล์ */}
                    <span className="absolute -top-1.5 -right-2.5">
                      <CountBadge count={counts?.answeredTickets} label="เรื่องที่ทีมงานตอบแล้ว" />
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-zinc-600 hover:text-zinc-900">
                    เข้าสู่ระบบ
                  </Link>
                  <Link to="/register" className="btn btn-primary">
                    สมัครสมาชิก
                  </Link>
                </>
              )}
            </nav>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet context={counts} />
      </main>
      <footer className="border-t border-zinc-100 py-8 text-center text-xs text-zinc-400">
        SwapHub · ตลาดซื้อขายแลกเปลี่ยนการ์ดเกม ·{' '}
        <Link to="/support" className="hover:text-zinc-700 hover:underline">
          ติดต่อทีมงาน
        </Link>
      </footer>
    </div>
  )
}

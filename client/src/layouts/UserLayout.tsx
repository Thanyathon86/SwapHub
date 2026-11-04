import { Link, NavLink, Outlet, ScrollRestoration, useNavigate } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { LogoMark } from '@shared/brand/Logo'
import { Avatar } from '@shared/components/Avatar'
import { CountBadge } from '@shared/components/CountBadge'
import { usePolling } from '@shared/lib/usePolling'
import { PlusIcon } from '../components/icons'
import { fetchCounts, OFFER_TASKS_LABEL, offerTasks } from '../features/counts/counts'
import { BottomNav } from './BottomNav'
import { HeaderSearch } from './HeaderSearch'
import { SiteFooter } from './SiteFooter'
import { StoreTabs } from './StoreTabs'

const COUNTS_INTERVAL_MS = 60_000

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm whitespace-nowrap transition ${isActive ? 'font-medium text-brand-600' : 'text-zinc-600 hover:text-zinc-900'}`

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
    // เว้นด้านล่างเท่าแถบเมนูมือถือ ไม่งั้น footer กับปุ่มท้ายหน้าจะโดนแถบบังจนกดไม่ได้
    <div className="flex min-h-screen flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <header className="bg-white">
        <div className="flex h-14 items-stretch lg:h-16">
          <Link
            to="/"
            aria-label="TCGNexus หน้าแรก"
            className="flex shrink-0 items-center gap-2 pl-3 text-lg font-bold tracking-tight text-zinc-900 sm:pl-4 lg:pl-6 lg:text-xl"
          >
            <LogoMark className="size-9 lg:size-10" />
            {/* จอเล็กเหลือแค่โลโก้ ช่องค้นหาจะได้กว้างพอพิมพ์ */}
            <span className="hidden sm:inline">
              TCG<span className="text-brand-600">Nexus</span>
            </span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center gap-6 px-3 sm:px-4 lg:px-6">
            <HeaderSearch />
            {/* จอเล็กใช้ BottomNav แทน */}
            {status === 'ready' && (
              <nav aria-label="บัญชี" className="ml-auto hidden shrink-0 items-center gap-5 lg:flex">
                {user ? (
                  <>
                    <NavLink to="/my-listings" className={navClass}>
                      ประกาศของฉัน
                    </NavLink>
                    <NavLink to="/offers" className={navClass}>
                      ข้อเสนอ
                      <CountBadge count={offerTasks(counts) ?? undefined} label={OFFER_TASKS_LABEL} />
                    </NavLink>
                    <button type="button" onClick={onLogout} className={navClass({ isActive: false })}>
                      ออกจากระบบ
                    </button>
                    <Link to="/sell" className="btn btn-primary">
                      <PlusIcon className="size-4" />
                      ลงประกาศ
                    </Link>
                    <Link to="/profile" title={user.displayName} className="relative rounded-full hover:opacity-80">
                      <Avatar user={user} />
                      {/* ทีมงานตอบเรื่องที่แจ้งแล้ว ลิงก์ไปหน้านั้นอยู่ในโปรไฟล์ */}
                      <span className="absolute -top-1.5 -right-2.5">
                        <CountBadge count={counts?.answeredTickets} label="เรื่องที่ทีมงานตอบแล้ว" />
                      </span>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="btn btn-primary">
                      เข้าสู่ระบบ
                    </Link>
                    <Link to="/register" className="btn btn-secondary">
                      สมัครสมาชิก
                    </Link>
                  </>
                )}
              </nav>
            )}
          </div>
        </div>
      </header>
      <StoreTabs />
      <main className="flex-1">
        <Outlet context={counts} />
      </main>
      <SiteFooter />
      <BottomNav counts={counts} />
      {/* หน้าแรกยาวขึ้นมาก ถ้าไม่มีตัวนี้ กดการ์ดแถวล่าง ๆ แล้วหน้าถัดไปจะเปิดค้างที่ตำแหน่งเลื่อนเดิม */}
      <ScrollRestoration />
    </div>
  )
}

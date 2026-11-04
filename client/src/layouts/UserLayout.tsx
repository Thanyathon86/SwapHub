import { Link, NavLink, Outlet, ScrollRestoration, useMatch, useNavigate } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { LogoMark } from '@shared/brand/Logo'
import { Avatar } from '@shared/components/Avatar'
import { CountBadge } from '@shared/components/CountBadge'
import { usePolling } from '@shared/lib/usePolling'
import { PlusIcon } from '../components/icons'
import { useChatStreamConnection, useCountsRefreshKey } from '../features/chat/chatStream'
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
  useChatStreamConnection(user !== null)
  const countsKey = useCountsRefreshKey(user?.id)
  const counts = usePolling(fetchCounts, COUNTS_INTERVAL_MS, user !== null, countsKey)
  // แชทใช้ความสูงเต็มจอเหมือนแอป แท็บหมวดกับ footer จะกินที่จนช่องพิมพ์ตกขอบ
  const inChat = useMatch('/messages/*') !== null
  // ในห้องแชทช่องพิมพ์อยู่ล่างสุดอยู่แล้ว ซ่อนเมนูล่างให้ข้อความเห็นได้มากขึ้น มีปุ่มย้อนกลับที่หัวห้อง
  const inRoom = useMatch('/messages/:id') !== null

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/', { replace: true })
  }

  return (
    // เว้นด้านล่างเท่าแถบเมนูมือถือ ไม่งั้น footer กับปุ่มท้ายหน้าจะโดนแถบบังจนกดไม่ได้
    <div className={`flex flex-col lg:pb-0 ${inChat ? 'h-dvh' : 'min-h-screen'} ${inRoom ? '' : 'pb-[calc(3.5rem+env(safe-area-inset-bottom))]'}`}>
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
                    <NavLink to="/messages" className={navClass}>
                      แชท
                      <CountBadge count={counts?.unreadMessages} label="ข้อความใหม่" />
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
      {!inChat && <StoreTabs />}
      <main className={`flex-1 ${inChat ? 'min-h-0 border-t border-zinc-200 lg:bg-zinc-50' : ''}`}>
        <Outlet context={counts} />
      </main>
      {!inChat && <SiteFooter />}
      {!inRoom && <BottomNav counts={counts} />}
      {/* หน้าแรกยาวขึ้นมาก ถ้าไม่มีตัวนี้ กดการ์ดแถวล่าง ๆ แล้วหน้าถัดไปจะเปิดค้างที่ตำแหน่งเลื่อนเดิม */}
      <ScrollRestoration />
    </div>
  )
}

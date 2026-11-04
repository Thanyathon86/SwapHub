import type { ComponentType } from 'react'
import { NavLink } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { CountBadge } from '@shared/components/CountBadge'
import { CardsIcon, ChatIcon, HomeIcon, PlusIcon, SwapIcon, UserIcon } from '../components/icons'
import { OFFER_TASKS_LABEL, offerTasks, type UserCounts } from '../features/counts/counts'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex h-full flex-col items-center justify-center gap-0.5 text-[11px] leading-none font-medium transition ${isActive ? 'text-brand-600' : 'text-zinc-500'}`

type ItemProps = {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
  count?: number | undefined
  countLabel?: string
}

function Item({ to, label, icon: Icon, end, count, countLabel = '' }: ItemProps) {
  return (
    <li>
      <NavLink to={to} end={end} className={linkClass}>
        <span className="relative">
          <Icon className="size-6" />
          {/* ml ของ CountBadge เผื่อไว้ตอนต่อท้ายข้อความ ตรงนี้วางทับไอคอนจึงไม่ต้องใช้ */}
          <span className="absolute -top-1.5 left-3.5 [&>span]:ml-0">
            <CountBadge count={count} label={countLabel} />
          </span>
        </span>
        {label}
      </NavLink>
    </li>
  )
}

// จอเล็กไม่มีที่วางเมนูบน header จึงย้ายมาไว้ด้านล่างที่นิ้วเอื้อมถึง เห็นตัวเลขงานค้างได้จากทุกหน้า
export function BottomNav({ counts }: { counts: UserCounts | null | undefined }) {
  const { user, status } = useAuth()
  const guest = status === 'ready' && !user

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid h-14 grid-cols-5">
        <Item to="/" end label="หน้าแรก" icon={HomeIcon} />
        {/* คนที่ล็อกอินแล้วหาการ์ดจากแท็บหมวดกับช่องค้นหาได้ ช่องนี้จึงให้แชทซึ่งไม่มีทางเข้าอื่น */}
        {user ? (
          <Item to="/messages" label="แชท" icon={ChatIcon} count={counts?.unreadMessages} countLabel="ข้อความใหม่" />
        ) : (
          <Item to="/browse" label="เรียกดู" icon={CardsIcon} />
        )}
        <li>
          <NavLink to="/sell" className={linkClass}>
            <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-white">
              <PlusIcon className="size-5" />
            </span>
            ลงประกาศ
          </NavLink>
        </li>
        <Item to="/offers" label="ข้อเสนอ" icon={SwapIcon} count={offerTasks(counts) ?? undefined} countLabel={OFFER_TASKS_LABEL} />
        {guest ? (
          <Item to="/login" label="เข้าสู่ระบบ" icon={UserIcon} />
        ) : (
          <Item to="/profile" label="บัญชี" icon={UserIcon} count={counts?.answeredTickets} countLabel="เรื่องที่ทีมงานตอบแล้ว" />
        )}
      </ul>
    </nav>
  )
}

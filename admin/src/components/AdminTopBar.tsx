import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Avatar } from '@shared/components/Avatar'
import { CountBadge } from '@shared/components/CountBadge'
import type { AdminCounts } from '../features/adminApi'
import { Icon, type IconName } from './icons'

type PopoverProps = {
  label: string
  buttonClass: string
  button: ReactNode
  children: (close: () => void) => ReactNode
}

// กดนอกกรอบหรือกด Esc แล้วปิด คนใช้ทั้งเมาส์และคีย์บอร์ดจะไม่ค้างอยู่กับเมนูที่เปิดทับเนื้อหา
function Popover({ label, buttonClass, button, children }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      close()
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  return (
    <div ref={root} className="relative shrink-0">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={buttonClass}
      >
        {button}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-[min(16rem,calc(100vw-2rem))] rounded-xl bg-white p-1.5 text-sm shadow-lg ring-1 ring-slate-200">
          {children(close)}
        </div>
      )}
    </div>
  )
}

const menuRowClass = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-slate-700 hover:bg-slate-50 hover:text-slate-900'

type PendingLink = { label: string; to: string; icon: IconName; count: number }

type Props = {
  counts: AdminCounts | null | undefined
  onLogout: () => void
}

export function AdminTopBar({ counts, onLogout }: Props) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const current = pathname === '/users' ? (new URLSearchParams(search).get('q') ?? '') : ''

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q')).trim()
    navigate(q ? `/users?q=${encodeURIComponent(q)}` : '/users')
  }

  const pending: PendingLink[] = [
    { label: 'ประกาศรอตรวจ', to: '/listings', icon: 'tag', count: counts?.pendingListings ?? 0 },
    { label: 'เรื่องที่รอตอบ', to: '/support', icon: 'message', count: counts?.openTickets ?? 0 },
  ]
  const total = pending.reduce((sum, item) => sum + item.count, 0)

  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
      <form role="search" onSubmit={onSearch} className="relative min-w-0 flex-1 lg:max-w-md">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
        {/* key: เปลี่ยนคำค้นจาก URL (เช่น กด back) แล้วช่องนี้ต้องตรงกับผลที่แสดง */}
        <input
          key={current}
          name="q"
          type="search"
          defaultValue={current}
          maxLength={100}
          aria-label="ค้นหาผู้ใช้"
          placeholder="ค้นหาผู้ใช้ด้วยอีเมลหรือชื่อ"
          className="input rounded-lg border-slate-200 bg-slate-50 py-1.5 pl-9 text-ellipsis focus:bg-white"
        />
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <Popover
          label={total > 0 ? `งานค้าง ${total} รายการ` : 'งานค้าง'}
          buttonClass="relative grid size-9 place-items-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          button={
            <>
              <Icon name="bell" />
              {/* ตำแหน่งทับไอคอน ไม่ต้องใช้ระยะที่ CountBadge เผื่อไว้ต่อท้ายข้อความ */}
              <span className="absolute -top-0.5 left-5 [&>span]:ml-0">
                <CountBadge count={total} label="งานค้าง" />
              </span>
            </>
          }
        >
          {(close) =>
            total === 0 ? (
              <p className="px-2.5 py-2 text-slate-500">ไม่มีงานค้าง</p>
            ) : (
              pending
                .filter((item) => item.count > 0)
                .map((item) => (
                  <Link key={item.to} to={item.to} onClick={close} className={menuRowClass}>
                    <Icon name={item.icon} className="size-4 text-slate-500" />
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <span className="font-semibold text-slate-900 tabular-nums">{item.count.toLocaleString('th-TH')}</span>
                  </Link>
                ))
            )
          }
        </Popover>

        {user && (
          <Popover
            label="เมนูบัญชี"
            buttonClass="flex items-center gap-2 rounded-full py-0.5 pr-1.5 pl-0.5 text-sm text-slate-700 hover:bg-slate-100"
            button={
              <>
                <Avatar user={user} />
                <span className="hidden max-w-32 truncate font-medium sm:inline">{user.displayName}</span>
                <Icon name="chevronDown" className="hidden size-4 text-slate-500 sm:block" />
              </>
            }
          >
            {(close) => (
              <>
                <div className="border-b border-slate-100 px-2.5 pt-1 pb-2">
                  <div className="truncate font-medium text-slate-900">{user.displayName}</div>
                  <div className="truncate text-xs text-slate-500">{user.email}</div>
                </div>
                <div className="pt-1">
                  <Link to="/account" onClick={close} className={menuRowClass}>
                    <Icon name="user" className="size-4 text-slate-500" />
                    บัญชีของฉัน
                  </Link>
                  <button type="button" onClick={onLogout} className={menuRowClass}>
                    <Icon name="logout" className="size-4 text-slate-500" />
                    ออกจากระบบ
                  </button>
                </div>
              </>
            )}
          </Popover>
        )}
      </div>
    </header>
  )
}

import { Link, useNavigate } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Avatar } from '@shared/components/Avatar'
import { CountBadge } from '@shared/components/CountBadge'
import { useCounts } from '../../features/counts/counts'

const menuClass = 'flex justify-between px-5 py-4 text-sm hover:bg-zinc-50'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const counts = useCounts()
  const navigate = useNavigate()

  if (!user) return null

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/', { replace: true })
  }

  return (
    <section className="mx-auto max-w-lg space-y-8">
      <div className="flex items-center gap-4">
        <Avatar user={user} size="md" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{user.displayName}</h1>
          <div className="text-sm text-zinc-500">@{user.username}</div>
        </div>
      </div>
      <div className="flex gap-3">
        <Link to={`/u/${user.username}`} className="btn btn-secondary flex-1">
          ดูโปรไฟล์ของฉัน
        </Link>
        <Link to="/profile/edit" className="btn btn-secondary flex-1">
          แก้ไขโปรไฟล์
        </Link>
      </div>
      <div className="divide-y divide-zinc-100 rounded-3xl ring-1 ring-zinc-200">
        <Link to="/my-listings" className={menuClass}>
          ประกาศของฉัน <span className="text-zinc-400">→</span>
        </Link>
        <Link to="/offers" className={menuClass}>
          <span>
            ข้อเสนอ
            <CountBadge count={counts?.incomingOffers} label="ข้อเสนอที่รอตอบ" />
          </span>
          <span className="text-zinc-400">→</span>
        </Link>
        <Link to="/support" className={menuClass}>
          <span>
            ติดต่อทีมงาน
            <CountBadge count={counts?.answeredTickets} label="เรื่องที่ทีมงานตอบแล้ว" />
          </span>
          <span className="text-zinc-400">→</span>
        </Link>
        <Link to="/settings" className={menuClass}>
          ตั้งค่าบัญชี <span className="text-zinc-400">→</span>
        </Link>
      </div>
      <button type="button" onClick={onLogout} className="btn btn-secondary">
        ออกจากระบบ
      </button>
    </section>
  )
}

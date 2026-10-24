import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/useAuth'

const menuClass = 'flex justify-between px-5 py-4 text-sm hover:bg-zinc-50'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/', { replace: true })
  }

  return (
    <section className="mx-auto max-w-lg space-y-8">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-700 uppercase">
          {user.displayName.slice(0, 1)}
        </span>
        <h1 className="text-2xl font-semibold">{user.displayName}</h1>
      </div>
      <div className="divide-y divide-zinc-100 rounded-3xl ring-1 ring-zinc-200">
        <Link to="/my-listings" className={menuClass}>
          ประกาศของฉัน <span className="text-zinc-400">→</span>
        </Link>
        <Link to="/offers" className={menuClass}>
          ข้อเสนอ <span className="text-zinc-400">→</span>
        </Link>
        {user.role === 'ADMIN' && (
          <Link to="/admin" className={menuClass}>
            หลังบ้าน <span className="text-zinc-400">→</span>
          </Link>
        )}
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

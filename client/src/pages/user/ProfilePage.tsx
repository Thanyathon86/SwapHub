import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/useAuth'
import { errorMessage } from '../../lib/api'

export default function ProfilePage() {
  const { user, logout, logoutAll } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>(null)

  if (!user) return null

  const onLogout = async () => {
    await logout().catch(() => undefined)
    navigate('/', { replace: true })
  }

  const onLogoutAll = async () => {
    if (!window.confirm('ออกจากระบบทุกอุปกรณ์ รวมถึงเครื่องนี้?')) return
    try {
      await logoutAll()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err)
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-8">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-full bg-zinc-100 text-xl font-semibold text-zinc-700 uppercase">
          {user.displayName.slice(0, 1)}
        </span>
        <div>
          <h1 className="text-2xl font-semibold">{user.displayName}</h1>
          <p className="text-sm text-zinc-500">{user.email}</p>
        </div>
      </div>
      <div className="divide-y divide-zinc-100 rounded-3xl ring-1 ring-zinc-200">
        <Link to="/my-listings" className="flex justify-between px-5 py-4 text-sm hover:bg-zinc-50">
          ประกาศของฉัน <span className="text-zinc-400">→</span>
        </Link>
        {user.role === 'ADMIN' && (
          <Link to="/admin" className="flex justify-between px-5 py-4 text-sm hover:bg-zinc-50">
            หลังบ้าน <span className="text-zinc-400">→</span>
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={onLogout} className="btn btn-secondary">
          ออกจากระบบ
        </button>
        <button type="button" onClick={onLogoutAll} className="btn btn-danger">
          ออกจากระบบทุกอุปกรณ์
        </button>
      </div>
      {error !== null && <p className="text-sm text-red-600">{errorMessage(error)}</p>}
    </section>
  )
}

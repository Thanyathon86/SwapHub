import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/useAuth'
import { errorMessage } from '../../lib/api'

export default function ProfilePage() {
  const { user, logoutAll } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>(null)

  if (!user) return null

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
    <section className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">โปรไฟล์</h1>
      <dl className="grid grid-cols-[8rem_1fr] gap-y-2 rounded-xl bg-white p-6 text-sm shadow-sm ring-1 ring-slate-200">
        <dt className="text-slate-500">ชื่อที่แสดง</dt>
        <dd>{user.displayName}</dd>
        <dt className="text-slate-500">อีเมล</dt>
        <dd>{user.email}</dd>
      </dl>
      <div className="space-y-2">
        <button
          type="button"
          onClick={onLogoutAll}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 hover:bg-red-50"
        >
          ออกจากระบบทุกอุปกรณ์
        </button>
        {error !== null && <p className="text-sm text-red-600">{errorMessage(error)}</p>}
      </div>
    </section>
  )
}

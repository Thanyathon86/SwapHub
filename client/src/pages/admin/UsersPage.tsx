import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Spinner } from '../../components/Spinner'
import { adminApi, type AdminUser, type UsersQuery, type UserStatus } from '../../features/admin/adminApi'
import { useAuth } from '../../features/auth/useAuth'
import { errorMessage } from '../../lib/api'
import { useResource } from '../../lib/useResource'

const statusLabels: Record<UserStatus, string> = { ACTIVE: 'ใช้งาน', SUSPENDED: 'ระงับ' }

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('th-TH') : '-')

// เก็บตัวกรองไว้ใน URL ให้กดย้อนกลับหรือแชร์ลิงก์แล้วได้หน้าเดิม
const readQuery = (params: URLSearchParams): UsersQuery & { q: string } => {
  const status = params.get('status')
  const page = Number(params.get('page'))
  return {
    q: params.get('q') ?? '',
    status: status === 'ACTIVE' || status === 'SUSPENDED' ? status : undefined,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const [params, setParams] = useSearchParams()
  const query = readQuery(params)
  const { data, error, loading, reload } = useResource(() => adminApi.listUsers(query), params.toString())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)

  const updateParams = (next: { q?: string; status?: string; page?: number }) => {
    const merged = { ...query, ...next }
    const p = new URLSearchParams()
    if (merged.q) p.set('q', merged.q)
    if (merged.status) p.set('status', merged.status)
    if (merged.page > 1) p.set('page', String(merged.page))
    setParams(p)
  }

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    updateParams({ q: String(form.get('q')).trim(), status: String(form.get('status')) || undefined, page: 1 })
  }

  const onToggleStatus = async (user: AdminUser) => {
    const next: UserStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    const message =
      next === 'SUSPENDED'
        ? `ระงับ ${user.email}? ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์ทันที`
        : `ปลดระงับ ${user.email}?`
    if (!window.confirm(message)) return
    setBusyId(user.id)
    setActionError(null)
    try {
      await adminApi.setUserStatus(user.id, next)
      reload()
    } catch (err) {
      setActionError(err)
    } finally {
      setBusyId(null)
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">ผู้ใช้</h1>

      {/* key ทำให้ช่องค้นหารีเซ็ตตาม URL เมื่อกดย้อนกลับ */}
      <form key={params.toString()} onSubmit={onSearch} className="flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={query.q}
          placeholder="ค้นหาอีเมลหรือชื่อ"
          aria-label="ค้นหา"
          className="min-w-60 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        <select
          name="status"
          defaultValue={query.status ?? ''}
          aria-label="สถานะ"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">ทุกสถานะ</option>
          <option value="ACTIVE">ใช้งาน</option>
          <option value="SUSPENDED">ระงับ</option>
        </select>
        <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
          ค้นหา
        </button>
      </form>

      {actionError !== null && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(actionError)}</p>}

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {error !== undefined && !data ? (
          <p className="px-6 py-4 text-sm text-red-600">{errorMessage(error)}</p>
        ) : !data ? (
          <Spinner />
        ) : data.users.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-500">ไม่พบผู้ใช้</p>
        ) : (
          <table className={`w-full text-left text-sm ${loading ? 'opacity-60' : ''}`}>
            <thead className="text-slate-500">
              <tr>
                <th className="px-6 py-2 font-medium">ผู้ใช้</th>
                <th className="px-3 py-2 font-medium">บทบาท</th>
                <th className="px-3 py-2 font-medium">สถานะ</th>
                <th className="px-3 py-2 font-medium">เข้าระบบล่าสุด</th>
                <th className="px-3 py-2 font-medium">สมัครเมื่อ</th>
                <th className="px-6 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-2">
                    <div className="font-medium text-slate-800">{u.displayName}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-3 py-2">{u.role === 'ADMIN' ? 'Admin' : 'User'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {statusLabels[u.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-slate-500">{formatDate(u.lastLoginAt)}</td>
                  <td className="px-3 py-2 text-slate-500">{formatDate(u.createdAt)}</td>
                  <td className="px-6 py-2 text-right">
                    {/* server กันไว้แล้ว ซ่อนปุ่มแค่ไม่ให้กดแล้วเจอ error */}
                    {u.role !== 'ADMIN' && u.id !== me?.id && (
                      <button
                        type="button"
                        onClick={() => onToggleStatus(u)}
                        disabled={busyId === u.id}
                        className={`hover:underline disabled:opacity-60 ${
                          u.status === 'ACTIVE' ? 'text-red-600' : 'text-indigo-600'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'ระงับ' : 'ปลดระงับ'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>ทั้งหมด {data.total} คน</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => updateParams({ page: query.page - 1 })}
              disabled={query.page <= 1}
              className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <span>
              หน้า {query.page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => updateParams({ page: query.page + 1 })}
              disabled={query.page >= totalPages}
              className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

import { Link, useSearchParams } from 'react-router'
import { Pagination } from '@shared/components/Pagination'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { ticketCategories, ticketCategoryLabel, type TicketStatus } from '@shared/support/types'
import { adminApi } from '../features/adminApi'
import { formatDateTime, ticketStatusLabels } from '../features/labels'

const statuses: TicketStatus[] = ['OPEN', 'ANSWERED', 'CLOSED']

export default function SupportPage() {
  // ตัวกรองอยู่ใน URL ให้กดเข้าเรื่องแล้วกดย้อนกลับมาที่แท็บเดิม
  const [params, setParams] = useSearchParams()
  const status = statuses.find((s) => s === params.get('status')) ?? 'OPEN'
  const category = ticketCategories.find((c) => c === params.get('category'))
  const pageParam = Number(params.get('page'))
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
  const { data, error, loading } = useResource(() => adminApi.listTickets({ status, category, page }), params.toString())

  const update = (next: { status?: TicketStatus; category?: string | undefined; page?: number }) => {
    const merged = { status, category, page, ...next }
    const p = new URLSearchParams({ status: merged.status })
    if (merged.category) p.set('category', merged.category)
    if (merged.page > 1) p.set('page', String(merged.page))
    setParams(p)
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">เรื่องที่แจ้ง</h1>
        <p className="mt-1 text-sm text-slate-500">แท็บ "รอตอบ" เรียงจากเรื่องที่รอนานที่สุดก่อน</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
          {statuses.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => update({ status: s, page: 1 })}
              className={`rounded-md px-3 py-1.5 text-sm ${
                status === s ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {ticketStatusLabels[s].text}
            </button>
          ))}
        </div>
        <select
          value={category ?? ''}
          onChange={(e) => update({ category: e.target.value || undefined, page: 1 })}
          aria-label="หมวด"
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">ทุกหมวด</option>
          {ticketCategories.map((c) => (
            <option key={c} value={c}>
              {ticketCategoryLabel[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {error !== undefined && !data ? (
          <p className="px-6 py-4 text-sm text-red-600">{errorMessage(error)}</p>
        ) : !data ? (
          <Spinner />
        ) : data.tickets.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-500">ไม่มีเรื่องในสถานะนี้</p>
        ) : (
          <table className={`w-full text-left text-sm ${loading ? 'opacity-60' : ''}`}>
            <thead className="text-slate-500">
              <tr>
                <th className="px-6 py-2 font-medium">เรื่อง</th>
                <th className="px-3 py-2 font-medium">ผู้แจ้ง</th>
                <th className="px-3 py-2 font-medium">ผู้รับเรื่อง</th>
                <th className="px-6 py-2 font-medium">อัปเดตล่าสุด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-6 py-2">
                    <Link to={`/support/${t.id}`} className="font-medium text-slate-800 hover:text-indigo-700 hover:underline">
                      {t.subject}
                    </Link>
                    <div className="text-xs text-slate-500">
                      {ticketCategoryLabel[t.category]} · {t._count.messages} ข้อความ
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="text-slate-800">{t.user.displayName}</div>
                    <div className="text-xs text-slate-500">{t.user.email}</div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{t.assignee?.displayName ?? <span className="text-slate-400">ยังไม่มี</span>}</td>
                  <td className="px-6 py-2 whitespace-nowrap text-slate-500">{formatDateTime(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>ทั้งหมด {data.total.toLocaleString('th-TH')} เรื่อง</span>
          <Pagination page={page} total={data.total} pageSize={data.pageSize} onChange={(p) => update({ page: p })} />
        </div>
      )}
    </section>
  )
}

import { useSearchParams } from 'react-router'
import { Pagination } from '@shared/components/Pagination'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { adminApi, type EventType } from '../features/adminApi'
import { eventTypeLabels, formatDateTime } from '../features/labels'

const types = Object.keys(eventTypeLabels) as EventType[]

export default function EventsPage() {
  // เก็บตัวกรองใน URL ให้ลิงก์จาก Dashboard เปิดมาที่ประเภทนั้นได้เลย
  const [params, setParams] = useSearchParams()
  const typeParam = params.get('type')
  const type = types.find((t) => t === typeParam)
  const pageParam = Number(params.get('page'))
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
  const { data, error, loading } = useResource(() => adminApi.listEvents(type, page), params.toString())

  const update = (next: { type?: EventType | undefined; page?: number }) => {
    const merged = { type, page, ...next }
    const p = new URLSearchParams()
    if (merged.type) p.set('type', merged.type)
    if (merged.page > 1) p.set('page', String(merged.page))
    setParams(p)
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Log ระบบ</h1>
        <p className="mt-1 text-sm text-slate-500">
          เหตุการณ์ด้านความปลอดภัยและข้อผิดพลาด เก็บไว้ 60 วันแล้วลบอัตโนมัติ (ประวัติการจัดการของ admin เก็บถาวรแยกต่างหาก)
        </p>
      </div>

      <select
        value={type ?? ''}
        onChange={(e) => update({ type: types.find((t) => t === e.target.value), page: 1 })}
        aria-label="ประเภทเหตุการณ์"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">ทุกประเภท</option>
        {types.map((t) => (
          <option key={t} value={t}>
            {eventTypeLabels[t].text}
          </option>
        ))}
      </select>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {error !== undefined && !data ? (
          <p className="px-6 py-4 text-sm text-red-600">{errorMessage(error)}</p>
        ) : !data ? (
          <Spinner />
        ) : data.events.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-500">ไม่มีเหตุการณ์</p>
        ) : (
          <table className={`w-full text-left text-sm ${loading ? 'opacity-60' : ''}`}>
            <thead className="text-slate-500">
              <tr>
                <th className="px-6 py-2 font-medium">เวลา</th>
                <th className="px-3 py-2 font-medium">ประเภท</th>
                <th className="px-3 py-2 font-medium">ผู้ใช้</th>
                <th className="px-3 py-2 font-medium">IP</th>
                <th className="px-3 py-2 font-medium">คำขอ</th>
                <th className="px-6 py-2 font-medium">รายละเอียด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.events.map((e) => {
                const label = eventTypeLabels[e.type]
                return (
                  <tr key={e.id} className="align-top">
                    <td className="px-6 py-2 whitespace-nowrap text-slate-500">{formatDateTime(e.createdAt)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${label.className}`}>{label.text}</span>
                    </td>
                    <td className="px-3 py-2">
                      {e.user ? (
                        <>
                          <div className="font-medium text-slate-800">{e.user.displayName}</div>
                          <div className="text-xs text-slate-500">{e.user.email}</div>
                        </>
                      ) : e.email ? (
                        // ล็อกอินไม่สำเร็จไม่มี user ให้ผูก แสดงอีเมลที่ลองใช้แทน
                        <div className="text-xs text-slate-500">ลองใช้ {e.email}</div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{e.ip ?? '-'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                      {e.method} {e.path}
                    </td>
                    <td className="px-6 py-2 text-xs text-slate-600">
                      {[e.statusCode, e.detail].filter(Boolean).join(' · ') || '-'}
                      {e.userAgent && (
                        <div className="mt-0.5 max-w-xs truncate text-slate-400" title={e.userAgent}>
                          {e.userAgent}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>ทั้งหมด {data.total.toLocaleString('th-TH')} รายการ</span>
          <Pagination page={page} total={data.total} pageSize={data.pageSize} onChange={(p) => update({ page: p })} />
        </div>
      )}
    </section>
  )
}

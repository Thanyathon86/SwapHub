import { useSearchParams } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { adminApi, type AuditAction } from '../features/adminApi'
import { auditActionLabels, formatDateTime } from '../features/labels'

const actions = Object.keys(auditActionLabels) as AuditAction[]

export default function AuditLogPage() {
  // เก็บตัวกรองใน URL ให้กดย้อนกลับหรือแชร์ลิงก์แล้วได้หน้าเดิม
  const [params, setParams] = useSearchParams()
  const actionParam = params.get('action')
  const action = actions.find((a) => a === actionParam)
  const pageParam = Number(params.get('page'))
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
  const { data, error, loading } = useResource(() => adminApi.listAuditLogs(action, page), params.toString())

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const update = (next: { action?: AuditAction | undefined; page?: number }) => {
    const merged = { action, page, ...next }
    const p = new URLSearchParams()
    if (merged.action) p.set('action', merged.action)
    if (merged.page > 1) p.set('page', String(merged.page))
    setParams(p)
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ประวัติการจัดการ</h1>
        <p className="mt-1 text-sm text-slate-500">
          บันทึกทุกครั้งที่ admin เปลี่ยนสิทธิ์หรือสถานะผู้ใช้ ตรวจประกาศ ซ่อนรีวิว แก้ข้อมูลเกมหรือบริษัทเกรด ปิดเรื่องที่แจ้ง และตัดสินเงินวางกลาง แก้ไขหรือลบไม่ได้
        </p>
      </div>

      <select
        value={action ?? ''}
        onChange={(e) => update({ action: actions.find((a) => a === e.target.value), page: 1 })}
        aria-label="ประเภทการจัดการ"
        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      >
        <option value="">ทุกประเภท</option>
        {actions.map((a) => (
          <option key={a} value={a}>
            {auditActionLabels[a].text}
          </option>
        ))}
      </select>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {error !== undefined && !data ? (
          <p className="px-6 py-4 text-sm text-red-600">{errorMessage(error)}</p>
        ) : !data ? (
          <Spinner />
        ) : data.logs.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-500">ยังไม่มีประวัติ</p>
        ) : (
          <table className={`w-full text-left text-sm ${loading ? 'opacity-60' : ''}`}>
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-6 py-2 font-medium">เวลา</th>
                <th className="px-3 py-2 font-medium">ผู้ทำ</th>
                <th className="px-3 py-2 font-medium">การกระทำ</th>
                <th className="px-6 py-2 font-medium">ผู้ใช้ที่เกี่ยวข้อง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.logs.map((log) => {
                const label = auditActionLabels[log.action]
                return (
                  <tr key={log.id} className="align-top">
                    <td className="px-6 py-2 whitespace-nowrap text-slate-500">{formatDateTime(log.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{log.actor.displayName}</div>
                      <div className="text-xs text-slate-500">{log.actor.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${label.className}`}>{label.text}</span>
                      {/* เหตุผลยาวได้ถึง 500 ตัวและอาจเป็นคำเดียวติดกัน ถ้าไม่จำกัดความกว้างและตัดคำ คอลัมน์นี้จะดันตารางจนต้องเลื่อนบนจอใหญ่ */}
                      {log.detail && <div className="mt-1 max-w-md min-w-48 text-xs wrap-anywhere text-slate-500">{log.detail}</div>}
                    </td>
                    <td className="px-6 py-2">
                      {log.targetUser ? (
                        <>
                          <div className="font-medium text-slate-800">{log.targetUser.displayName}</div>
                          <div className="text-xs text-slate-500">{log.targetUser.email}</div>
                        </>
                      ) : (
                        <span className="text-slate-400">-</span>
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
          <span>ทั้งหมด {data.total} รายการ</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => update({ page: page - 1 })}
              disabled={page <= 1}
              className="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <span>
              หน้า {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => update({ page: page + 1 })}
              disabled={page >= totalPages}
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

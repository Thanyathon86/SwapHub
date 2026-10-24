import { useSearchParams } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { adminApi } from '../features/adminApi'
import { auditActionLabels, formatDateTime } from '../features/labels'

export default function AuditLogPage() {
  const [params, setParams] = useSearchParams()
  const pageParam = Number(params.get('page'))
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
  const { data, error, loading } = useResource(() => adminApi.listAuditLogs(page), String(page))

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1
  const goTo = (next: number) => setParams(next > 1 ? { page: String(next) } : {})

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">ประวัติการจัดการ</h1>
        <p className="mt-1 text-sm text-slate-500">บันทึกทุกครั้งที่ admin เปลี่ยนบทบาทหรือสถานะของผู้ใช้ แก้ไขหรือลบไม่ได้</p>
      </div>

      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        {error !== undefined && !data ? (
          <p className="px-6 py-4 text-sm text-red-600">{errorMessage(error)}</p>
        ) : !data ? (
          <Spinner />
        ) : data.logs.length === 0 ? (
          <p className="px-6 py-4 text-sm text-slate-500">ยังไม่มีประวัติ</p>
        ) : (
          <table className={`w-full text-left text-sm ${loading ? 'opacity-60' : ''}`}>
            <thead className="text-slate-500">
              <tr>
                <th className="px-6 py-2 font-medium">เวลา</th>
                <th className="px-3 py-2 font-medium">ผู้ทำ</th>
                <th className="px-3 py-2 font-medium">การกระทำ</th>
                <th className="px-6 py-2 font-medium">ผู้ใช้ที่ถูกแก้</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.logs.map((log) => {
                const action = auditActionLabels[log.action]
                return (
                  <tr key={log.id}>
                    <td className="px-6 py-2 whitespace-nowrap text-slate-500">{formatDateTime(log.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800">{log.actor.displayName}</div>
                      <div className="text-xs text-slate-500">{log.actor.email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${action.className}`}>{action.text}</span>
                    </td>
                    <td className="px-6 py-2">
                      <div className="font-medium text-slate-800">{log.targetUser.displayName}</div>
                      <div className="text-xs text-slate-500">{log.targetUser.email}</div>
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
              onClick={() => goTo(page - 1)}
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
              onClick={() => goTo(page + 1)}
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

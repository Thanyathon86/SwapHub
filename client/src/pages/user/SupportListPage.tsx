import { Link, useLocation } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { ticketCategoryLabel } from '@shared/support/types'
import { supportApi, ticketStatusLabel } from '../../features/support/supportApi'

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

export default function SupportListPage() {
  const location = useLocation()
  const closedId = (location.state as { closed?: string } | null)?.closed
  const { data: tickets, error } = useResource(supportApi.list)

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">ติดต่อทีมงาน</h1>
          <p className="mt-2 text-sm text-zinc-500">แจ้งปัญหาหรือสอบถามเรื่องบัญชี ประกาศ และการซื้อขาย</p>
        </div>
        <Link to="/support/new" className="btn btn-primary">
          แจ้งเรื่องใหม่
        </Link>
      </div>

      {closedId && <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-600">ปิดเรื่องแล้ว ขอบคุณที่แจ้งเข้ามา</p>}

      {error !== undefined && !tickets ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(error)}</p>
      ) : !tickets ? (
        <Spinner />
      ) : tickets.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 px-6 py-20 text-center">
          <p className="font-medium">ยังไม่เคยแจ้งเรื่อง</p>
          <p className="mt-1 text-sm text-zinc-500">มีปัญหาตรงไหน แจ้งทีมงานได้เลย</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 rounded-3xl ring-1 ring-zinc-200">
          {tickets.map((t) => {
            const status = ticketStatusLabel[t.status]
            return (
              <li key={t.id}>
                <Link to={`/support/${t.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-50">
                  <div className="min-w-0 flex-1">
                    <div className={`truncate ${t.status === 'ANSWERED' ? 'font-semibold' : 'font-medium'}`}>{t.subject}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {ticketCategoryLabel[t.category]} · อัปเดต {formatDate(t.updatedAt)}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${status.className}`}>
                    {status.text}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

import { Link, useSearchParams } from 'react-router'
import { Pagination } from '@shared/components/Pagination'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { formatPrice } from '@shared/listings/labels'
import { useResource } from '@shared/lib/useResource'
import { adminApi, type EscrowStatus } from '../features/adminApi'
import { escrowStatusLabels, formatDateTime } from '../features/labels'

const statuses = Object.keys(escrowStatusLabels) as EscrowStatus[]

export default function EscrowPage() {
  // เก็บตัวกรองไว้ใน URL ให้กดย้อนกลับหรือแชร์ลิงก์แล้วได้หน้าเดิม
  const [params, setParams] = useSearchParams()
  const status = statuses.find((s) => s === params.get('status')) ?? 'DISPUTED'
  const pageParam = Number(params.get('page'))
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1
  const { data, error, loading } = useResource(() => adminApi.listEscrows(status, page), params.toString())

  const go = (next: { status?: EscrowStatus; page?: number }) => {
    const merged = { status, page, ...next }
    const p = new URLSearchParams({ status: merged.status })
    if (merged.page > 1) p.set('page', String(merged.page))
    setParams(p)
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">เงินวางกลาง</h1>
        <p className="mt-1 text-sm text-slate-500">
          ตัดสินข้อพิพาทและดูแลดีลที่เงินยังค้างอยู่ ทุกคำตัดสินถูกบันทึกในประวัติการจัดการ การจ่ายเงินตอนนี้เป็นแบบจำลอง ไม่มีเงินจริง
        </p>
      </div>

      {data && (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          ระบบถือเงินอยู่ <span className="font-semibold text-slate-800 tabular-nums">{formatPrice(data.holding.amount)}</span> จาก{' '}
          {data.holding.count} ดีล
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go({ status: s, page: 1 })}
            className={`rounded-full px-4 py-1.5 text-sm ${s === status ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'}`}
          >
            {escrowStatusLabels[s].text}
          </button>
        ))}
      </div>

      {error !== undefined && !data ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
      ) : !data ? (
        <Spinner />
      ) : data.escrows.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">ไม่มีรายการ</p>
      ) : (
        <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">ประกาศ</th>
                  <th className="px-4 py-3 font-medium">ผู้ซื้อ</th>
                  <th className="px-4 py-3 font-medium">ผู้ขาย</th>
                  <th className="px-4 py-3 text-right font-medium">ยอด</th>
                  <th className="px-4 py-3 font-medium">สถานะ</th>
                  <th className="px-4 py-3 font-medium">อัปเดต</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.escrows.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3">
                      <Link to={`/escrows/${e.id}`} className="font-medium text-slate-800 hover:underline">
                        {e.offer.listing.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{e.buyer.displayName}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{e.seller.displayName}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">{formatPrice(e.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${escrowStatusLabels[e.status].className}`}>
                        {escrowStatusLabels[e.status].text}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDateTime(e.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onChange={(next) => go({ page: next })} />
        </div>
      )}
    </section>
  )
}

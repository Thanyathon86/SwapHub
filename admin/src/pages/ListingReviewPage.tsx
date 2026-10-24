import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Pagination } from '@shared/components/Pagination'
import { Spinner } from '@shared/components/Spinner'
import { adminApi, type AdminListing } from '../features/adminApi'
import {
  artPropsOf,
  conditionLabel,
  formatDate,
  formatGrade,
  formatPrice,
  kindLabel,
  statusLabel,
  typeLabel,
} from '@shared/listings/labels'
import { ListingArt } from '@shared/listings/ListingArt'
import type { ListingStatus } from '@shared/listings/listingsApi'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'

const statuses: ListingStatus[] = ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'CLOSED']

const kindDetail = (l: AdminListing) => {
  if (l.itemKind === 'GRADED') return `${l.gradingCompany?.name ?? '-'} ${formatGrade(l.grade)} · เซอร์ ${l.certNumber}`
  if (l.itemKind === 'SINGLE' && l.condition) return `${l.condition} (${conditionLabel[l.condition]}) · ${l.quantity} ใบ`
  return `${l.quantity} ชิ้น`
}

export default function ListingReviewPage() {
  const [params, setParams] = useSearchParams()
  const status = statuses.find((s) => s === params.get('status')) ?? 'PENDING_REVIEW'
  const pageParam = Number(params.get('page'))
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1

  const { data, error, loading, reload } = useResource(
    () => adminApi.listListings({ status, page }),
    `${status}:${page}`,
  )
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<{ id: string; error: unknown } | null>(null)

  const go = (next: { status?: ListingStatus; page?: number }) => {
    const p = new URLSearchParams({ status: next.status ?? status })
    if (next.page && next.page > 1) p.set('page', String(next.page))
    setParams(p)
  }

  const review = async (id: string, body: Parameters<typeof adminApi.reviewListing>[1]) => {
    setBusyId(id)
    setActionError(null)
    try {
      await adminApi.reviewListing(id, body)
      setRejecting(null)
      reload()
    } catch (err) {
      setActionError({ id, error: err })
      // ถูก admin คนอื่นตรวจไปแล้ว โหลดใหม่ให้รายการตรงกับความจริง
      reload()
    } finally {
      setBusyId(null)
    }
  }

  const onReject = (id: string) => (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const reason = String(new FormData(e.currentTarget).get('reason')).trim()
    if (reason) void review(id, { decision: 'REJECT', reason })
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">ประกาศ</h1>

      <div className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go({ status: s })}
            className={`rounded-full px-4 py-1.5 text-sm ${s === status ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'}`}
          >
            {statusLabel[s]}
          </button>
        ))}
      </div>

      {error !== undefined && !data ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
      ) : !data ? (
        <Spinner />
      ) : data.listings.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">
          {status === 'PENDING_REVIEW' ? 'ไม่มีประกาศรอตรวจ' : 'ไม่มีประกาศในสถานะนี้'}
        </p>
      ) : (
        <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          <p className="text-sm text-slate-500">ทั้งหมด {data.total} รายการ</p>
          {data.listings.map((l) => (
            <article key={l.id} className="flex gap-5 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="w-24 shrink-0">
                <ListingArt {...artPropsOf(l)} />
              </div>
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="text-xs text-slate-500">
                  {l.game.name} · {kindLabel[l.itemKind]} · {typeLabel[l.type]}
                </div>
                <div className="text-base font-semibold text-slate-800">{l.title}</div>
                <div className="text-slate-600">
                  {l.setName}
                  {l.cardNumber && ` · ${l.cardNumber}`}
                  {l.rarity && ` · ${l.rarity}`} · {l.language}
                </div>
                <div className="text-slate-600">{kindDetail(l)}</div>
                <div className="font-semibold">{formatPrice(l.price) ?? 'แลกเท่านั้น'}</div>
                {l.description && <p className="line-clamp-3 whitespace-pre-line text-slate-500">{l.description}</p>}
                <div className="pt-1 text-xs text-slate-500">
                  {l.seller.displayName} ({l.seller.email}) · ลงเมื่อ {formatDate(l.createdAt)}
                  {l.reviewedBy && l.reviewedAt && ` · ตรวจโดย ${l.reviewedBy.displayName} ${formatDate(l.reviewedAt)}`}
                </div>
                {l.rejectReason && <p className="text-xs text-red-600">เหตุผลที่ไม่ผ่าน: {l.rejectReason}</p>}
                {actionError?.id === l.id && <p className="text-red-600">{errorMessage(actionError.error)}</p>}

                {l.status === 'PENDING_REVIEW' &&
                  (rejecting === l.id ? (
                    <form onSubmit={onReject(l.id)} className="flex flex-wrap gap-2 pt-2">
                      <input
                        name="reason"
                        required
                        maxLength={500}
                        autoFocus
                        placeholder="เหตุผล (ผู้ขายจะเห็นข้อความนี้)"
                        aria-label="เหตุผลที่ไม่อนุมัติ"
                        className="min-w-60 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 outline-none focus:border-slate-500"
                      />
                      <button
                        type="submit"
                        disabled={busyId === l.id}
                        className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        ยืนยันไม่อนุมัติ
                      </button>
                      <button type="button" onClick={() => setRejecting(null)} className="px-2 text-slate-500">
                        ยกเลิก
                      </button>
                    </form>
                  ) : (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        disabled={busyId === l.id}
                        onClick={() => review(l.id, { decision: 'APPROVE' })}
                        className="rounded-lg bg-emerald-600 px-4 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        อนุมัติ
                      </button>
                      <button
                        type="button"
                        disabled={busyId === l.id}
                        onClick={() => setRejecting(l.id)}
                        className="rounded-lg px-4 py-1.5 font-medium text-red-600 ring-1 ring-red-200 hover:bg-red-50"
                      >
                        ไม่อนุมัติ
                      </button>
                    </div>
                  ))}
              </div>
            </article>
          ))}
          <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onChange={(p) => go({ page: p })} />
        </div>
      )}
    </section>
  )
}

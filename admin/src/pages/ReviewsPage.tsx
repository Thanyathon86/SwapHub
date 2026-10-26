import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { Pagination } from '@shared/components/Pagination'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { Stars } from '@shared/reviews/StarRating'
import { adminApi, type ReviewsQuery, type ReviewStatus } from '../features/adminApi'
import { formatDateTime } from '../features/labels'
import { clientUrl } from '../lib/env'

const statusLabel: Record<ReviewStatus, string> = { VISIBLE: 'แสดงอยู่', REMOVED: 'ซ่อนแล้ว' }

// เก็บตัวกรองไว้ใน URL ให้กดย้อนกลับหรือแชร์ลิงก์แล้วได้หน้าเดิม
const readQuery = (params: URLSearchParams): ReviewsQuery & { q: string } => {
  const page = Number(params.get('page'))
  return {
    q: params.get('q') ?? '',
    status: params.get('status') === 'REMOVED' ? 'REMOVED' : 'VISIBLE',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

export default function ReviewsPage() {
  const [params, setParams] = useSearchParams()
  const query = readQuery(params)
  const { data, error, loading, reload } = useResource(() => adminApi.listReviews(query), params.toString())
  const [removing, setRemoving] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<{ id: string; error: unknown } | null>(null)

  const go = (next: Partial<ReviewsQuery>) => {
    const merged = { ...query, ...next }
    const p = new URLSearchParams()
    if (merged.q) p.set('q', merged.q)
    if (merged.status !== 'VISIBLE') p.set('status', merged.status)
    if (merged.page > 1) p.set('page', String(merged.page))
    setParams(p)
  }

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    go({ q: String(new FormData(e.currentTarget).get('q')).trim(), page: 1 })
  }

  const onRemove = (id: string) => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const reason = String(new FormData(e.currentTarget).get('reason')).trim()
    if (!reason) return
    setBusyId(id)
    setActionError(null)
    try {
      await adminApi.removeReview(id, reason)
      setRemoving(null)
    } catch (err) {
      setActionError({ id, error: err })
    } finally {
      setBusyId(null)
      // ซ่อนสำเร็จหรือถูก admin คนอื่นซ่อนไปก่อน โหลดใหม่ให้รายการตรงกับความจริง
      reload()
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">รีวิว</h1>
        <p className="mt-1 text-sm text-slate-500">
          ซ่อนรีวิวที่ไม่เหมาะสม รีวิวที่ซ่อนจะไม่แสดงบนโปรไฟล์และไม่นับในคะแนนเฉลี่ย ทุกครั้งที่ซ่อนถูกบันทึกในประวัติการจัดการ
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {(['VISIBLE', 'REMOVED'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => go({ status: s, page: 1 })}
            className={`rounded-full px-4 py-1.5 text-sm ${s === query.status ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'}`}
          >
            {statusLabel[s]}
          </button>
        ))}
        <form onSubmit={onSearch} className="ml-auto flex gap-2">
          <input
            key={query.q}
            name="q"
            defaultValue={query.q}
            placeholder="username คนเขียนหรือคนถูกรีวิว"
            aria-label="ค้นหาด้วย username"
            className="w-72 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          />
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-1.5 text-sm text-white">
            ค้นหา
          </button>
        </form>
      </div>

      {error !== undefined && !data ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
      ) : !data ? (
        <Spinner />
      ) : data.reviews.length === 0 ? (
        <p className="rounded-xl bg-white p-6 text-sm text-slate-500 ring-1 ring-slate-200">ไม่มีรีวิว</p>
      ) : (
        <div className={`space-y-3 ${loading ? 'opacity-60' : ''}`}>
          <p className="text-sm text-slate-500">ทั้งหมด {data.total} รายการ</p>
          {data.reviews.map((r) => (
            <article key={r.id} className="space-y-1 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-x-2 text-slate-600">
                <Stars value={r.rating} />
                <a href={`${clientUrl}/u/${r.reviewer.username}`} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:underline">
                  {r.reviewer.displayName}
                </a>
                <span>→</span>
                <a href={`${clientUrl}/u/${r.reviewee.username}`} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:underline">
                  {r.reviewee.displayName}
                </a>
                <span className="text-xs text-slate-500">· {r.offer.listing.title} · {formatDateTime(r.createdAt)}</span>
              </div>
              {r.comment ? (
                <p className="whitespace-pre-line text-slate-700">{r.comment}</p>
              ) : (
                <p className="text-slate-400">ไม่มีความเห็น</p>
              )}
              {r.removedAt && (
                <p className="text-xs text-rose-700">
                  ซ่อนโดย {r.removedBy?.displayName ?? '-'} {formatDateTime(r.removedAt)} · เหตุผล: {r.removeReason}
                </p>
              )}
              {actionError?.id === r.id && <p className="text-red-600">{errorMessage(actionError.error)}</p>}

              {!r.removedAt &&
                (removing === r.id ? (
                  <form onSubmit={onRemove(r.id)} className="flex flex-wrap gap-2 pt-2">
                    <input
                      name="reason"
                      required
                      maxLength={500}
                      autoFocus
                      placeholder="เหตุผล (บันทึกในประวัติการจัดการ)"
                      aria-label="เหตุผลที่ซ่อนรีวิว"
                      className="min-w-60 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 outline-none focus:border-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={busyId === r.id}
                      className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      ยืนยันซ่อน
                    </button>
                    <button type="button" onClick={() => setRemoving(null)} className="px-2 text-slate-500">
                      ยกเลิก
                    </button>
                  </form>
                ) : (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setRemoving(r.id)}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-red-700 hover:bg-red-50"
                    >
                      ซ่อนรีวิว
                    </button>
                  </div>
                ))}
            </article>
          ))}
          <Pagination page={data.page} total={data.total} pageSize={data.pageSize} onChange={(page) => go({ page })} />
        </div>
      )}
    </section>
  )
}

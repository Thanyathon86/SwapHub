import { useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '@shared/components/Avatar'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { Stars } from '@shared/reviews/StarRating'
import { profileApi, type ProfileReview } from './profileApi'

const formatDay = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

// โหลดทีละหน้าแล้วต่อท้าย ("ดูเพิ่ม") อ่านต่อเนื่องได้เหมือนฟีด
export function ProfileReviews({ username }: { username: string }) {
  const [page, setPage] = useState(1)
  const [earlier, setEarlier] = useState<ProfileReview[]>([])
  const { data, error, loading } = useResource(() => profileApi.reviews(username, page), `${username}:${page}`)

  if (error !== undefined && !data) return <p className="text-sm text-red-600">{errorMessage(error)}</p>
  if (!data) return <Spinner />

  const reviews = [...earlier, ...data.reviews]
  if (reviews.length === 0) return <p className="py-12 text-center text-sm text-zinc-500">ยังไม่มีรีวิว</p>

  return (
    <div className="space-y-6">
      <ul className="divide-y divide-zinc-100">
        {reviews.map((r) => (
          <li key={r.id} className="flex gap-3 py-4">
            <Link to={`/u/${r.reviewer.username}`} className="shrink-0">
              <Avatar user={r.reviewer} />
            </Link>
            <div className="min-w-0 flex-1 space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-x-2">
                <Link to={`/u/${r.reviewer.username}`} className="font-medium hover:underline">
                  {r.reviewer.displayName}
                </Link>
                <Stars value={r.rating} />
                <span className="text-xs text-zinc-400">{formatDay(r.updatedAt)}</span>
              </div>
              <div className="text-xs text-zinc-500">
                {r.reviewerRole === 'BUYER' ? 'ผู้ซื้อ/ผู้ขอแลก' : 'ผู้ขาย'} · {r.listingTitle}
              </div>
              {r.comment && <p className="whitespace-pre-line text-zinc-700">{r.comment}</p>}
            </div>
          </li>
        ))}
      </ul>
      {reviews.length < data.total && (
        <div className="text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setEarlier(reviews)
              setPage((p) => p + 1)
            }}
            className="btn btn-secondary"
          >
            ดูเพิ่ม
          </button>
        </div>
      )}
    </div>
  )
}

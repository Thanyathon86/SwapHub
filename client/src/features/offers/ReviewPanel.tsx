import { useState, type FormEvent } from 'react'
import { errorMessage } from '@shared/lib/api'
import { StarInput, Stars } from '@shared/reviews/StarRating'
import { offersApi, type Offer, type Party } from './offersApi'

const formatDay = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })

// ส่วนให้คะแนนใต้ดีลที่ตอบรับแล้ว เห็นทั้งคะแนนที่เราให้และที่อีกฝ่ายให้เรา
export function ReviewPanel({ offer, me, other, onSaved }: { offer: Offer; me: string; other: Party; onSaved: () => void }) {
  const mine = offer.reviews.find((r) => r.reviewerId === me)
  const theirs = offer.reviews.find((r) => r.reviewerId !== me)
  // จับเวลาครั้งเดียวตอนเปิดหน้า ไม่ต้องแม่นระดับวินาที server ตรวจกำหนดเวลาซ้ำอีกทีอยู่แล้ว
  const [now] = useState(() => Date.now())
  const open = offer.reviewDeadline !== null && new Date(offer.reviewDeadline).getTime() > now
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [comment, setComment] = useState(mine?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await offersApi.review(offer.id, { rating, comment })
      setEditing(false)
      onSaved()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-xl bg-zinc-50 px-3 py-3 text-sm">
      {theirs && (
        <div>
          <span className="text-zinc-500">{other.displayName} ให้คุณ</span> <Stars value={theirs.rating} />
          {theirs.comment && <p className="mt-0.5 text-zinc-700">“{theirs.comment}”</p>}
        </div>
      )}

      {editing ? (
        <form onSubmit={onSubmit} className="space-y-2">
          <StarInput value={rating} onChange={setRating} name={`rating-${offer.id}`} />
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={`เล่าประสบการณ์กับ ${other.displayName} (ไม่บังคับ)`}
            aria-label="ความเห็น"
            className="input"
          />
          {error !== null && <p className="text-red-600">{errorMessage(error)}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={busy || rating === 0} className="btn btn-primary">
              บันทึก
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-secondary">
              ยกเลิก
            </button>
            {offer.reviewDeadline && <span className="text-xs text-zinc-500">แก้ได้ถึง {formatDay(offer.reviewDeadline)}</span>}
          </div>
        </form>
      ) : mine ? (
        <div>
          <span className="text-zinc-500">คุณให้ {other.displayName}</span> <Stars value={mine.rating} />
          {mine.comment && <p className="mt-0.5 text-zinc-700">“{mine.comment}”</p>}
          {open && (
            <button type="button" onClick={() => setEditing(true)} className="mt-1 text-xs text-zinc-500 underline">
              แก้คะแนน
            </button>
          )}
        </div>
      ) : open ? (
        <button type="button" onClick={() => setEditing(true)} className="btn btn-secondary">
          ★ ให้คะแนน {other.displayName}
        </button>
      ) : (
        <p className="text-zinc-400">เลยกำหนดให้คะแนนแล้ว</p>
      )}
    </div>
  )
}

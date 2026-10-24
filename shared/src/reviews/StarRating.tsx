import { useState } from 'react'

export type RatingSummary = { average: number | null; count: number }

const STARS = [1, 2, 3, 4, 5]

// สรุปคะแนนสั้น ๆ เช่น ★ 4.8 (23) ใช้ข้างชื่อผู้ใช้ ถ้ายังไม่มีรีวิวบอกตรง ๆ ไม่แสดง 0 ดาว (ดูเหมือนคนแย่)
export function RatingBadge({ rating, className = '' }: { rating: RatingSummary; className?: string }) {
  if (rating.count === 0 || rating.average === null) {
    return <span className={`text-xs text-zinc-400 ${className}`}>ยังไม่มีรีวิว</span>
  }
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm ${className}`}
      aria-label={`คะแนน ${rating.average} จาก 5 จาก ${rating.count} รีวิว`}
    >
      <span aria-hidden="true" className="text-amber-500">
        ★
      </span>
      <span className="font-semibold tabular-nums">{rating.average.toFixed(1)}</span>
      <span className="text-zinc-500 tabular-nums">({rating.count})</span>
    </span>
  )
}

// ดาวแบบคงที่สำหรับแต่ละรีวิว
export function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} ดาว`} className="tracking-tight">
      {STARS.map((n) => (
        <span key={n} aria-hidden="true" className={n <= value ? 'text-amber-500' : 'text-zinc-200'}>
          ★
        </span>
      ))}
    </span>
  )
}

const hints = ['', 'แย่มาก', 'ไม่ค่อยดี', 'พอใช้', 'ดี', 'ดีมาก']

// ปุ่มเลือกดาว ใช้ radio ข้างใต้เพื่อให้ใช้คีย์บอร์ดและ screen reader ได้
export function StarInput({ value, onChange, name = 'rating' }: { value: number; onChange: (v: number) => void; name?: string }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="flex items-center gap-3">
      <div role="radiogroup" aria-label="ให้คะแนน" className="flex" onMouseLeave={() => setHover(0)}>
        {STARS.map((n) => (
          <label key={n} onMouseEnter={() => setHover(n)} className="cursor-pointer px-0.5 text-3xl leading-none">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span
              aria-hidden="true"
              className={`rounded peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-900 ${n <= shown ? 'text-amber-500' : 'text-zinc-200'}`}
            >
              ★
            </span>
            <span className="sr-only">{n} ดาว</span>
          </label>
        ))}
      </div>
      <span className="text-sm text-zinc-500">{hints[shown]}</span>
    </div>
  )
}

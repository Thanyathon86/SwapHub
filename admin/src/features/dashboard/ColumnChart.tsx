import { useState } from 'react'

export type ColumnPoint = { label: string; value: number }

// indigo-600 ผ่าน validator ของ dataviz (contrast กับพื้นขาว >= 3:1) ใช้สีเดียวเพราะแต่ละกราฟมี series เดียว
const BAR_COLOR = '#4f46e5'
const HEIGHT = 120

// ปัดค่าสูงสุดของแกนเป็นเลขกลม ๆ (1, 2, 5, 10, 20, ...) ให้อ่าน tick ง่าย
const niceCeil = (n: number) => {
  if (n <= 1) return 1
  const mag = 10 ** Math.floor(Math.log10(n))
  return ([1, 2, 5, 10].find((m) => n <= m * mag) ?? 10) * mag
}

// กราฟแท่งแนวตั้ง series เดียว ไม่มี legend เพราะชื่อกราฟบอกอยู่แล้วว่าแสดงอะไร
export function ColumnChart({ title, points, unit }: { title: string; points: ColumnPoint[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = niceCeil(Math.max(0, ...points.map((p) => p.value)))
  const total = points.reduce((sum, p) => sum + p.value, 0)
  const ticks = max >= 2 ? [max, max / 2, 0] : [max, 0]
  const hovered = hover === null ? undefined : points[hover]
  // label แกน x แค่ต้น กลาง ท้าย ไม่ใส่ทุกวันจนชนกัน
  const xLabels = new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])

  return (
    <figure className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{title}</span>
        <span className="text-xs text-slate-500">
          รวม 30 วัน <span className="font-semibold text-slate-800 tabular-nums">{total.toLocaleString('th-TH')}</span>
        </span>
      </figcaption>

      <div className="mt-4 flex gap-2">
        {/* แกน y */}
        <div className="relative w-6 shrink-0 text-right text-[11px] text-slate-400 tabular-nums" style={{ height: HEIGHT }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / max) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height: HEIGHT }} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0 border-t border-slate-100"
                style={{ top: `${(1 - t / max) * 100}%` }}
              />
            ))}
            {/* ช่องว่าง 2px ระหว่างแท่งคือ gap-0.5 แต่ละช่องทั้งแนวสูงเป็นพื้นที่ hover ใหญ่กว่าตัวแท่ง */}
            <div className="absolute inset-0 flex items-end gap-0.5" role="img" aria-label={`${title} รวม ${total} ${unit} ใน 30 วัน`}>
              {points.map((p, i) => (
                <div
                  key={p.label}
                  className="flex h-full flex-1 items-end justify-center"
                  onMouseEnter={() => setHover(i)}
                >
                  <div
                    className="w-full max-w-6 rounded-t transition-opacity"
                    style={{
                      height: `${(p.value / max) * 100}%`,
                      backgroundColor: BAR_COLOR,
                      opacity: hover === null || hover === i ? 1 : 0.4,
                    }}
                  />
                </div>
              ))}
            </div>

            {hovered && hover !== null && (
              <div
                className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-2 py-1 text-xs whitespace-nowrap text-white shadow"
                style={{ left: `${((hover + 0.5) / points.length) * 100}%` }}
              >
                {hovered.label} · <span className="font-semibold tabular-nums">{hovered.value}</span> {unit}
              </div>
            )}
          </div>

          <div className="relative mt-1.5 h-4 text-[11px] text-slate-400">
            {points.map((p, i) =>
              xLabels.has(i) ? (
                <span
                  key={p.label}
                  className={`absolute ${i === 0 ? 'left-0' : i === points.length - 1 ? 'right-0' : '-translate-x-1/2'}`}
                  style={i !== 0 && i !== points.length - 1 ? { left: `${((i + 0.5) / points.length) * 100}%` } : undefined}
                >
                  {p.label}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </div>

      {/* ตารางให้คนที่ใช้ screen reader หรืออยากเห็นตัวเลขทุกวัน */}
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer hover:text-slate-700">ดูเป็นตาราง</summary>
        <table className="mt-2 w-full">
          <tbody className="divide-y divide-slate-100">
            {points.map((p) => (
              <tr key={p.label}>
                <td className="py-1">{p.label}</td>
                <td className="py-1 text-right text-slate-700 tabular-nums">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

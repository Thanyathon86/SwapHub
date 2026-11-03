import { useState } from 'react'

export type ColumnPoint = { label: string; value: number }
export type ColumnMetric = { key: string; label: string; unit: string; points: ColumnPoint[] }

const HEIGHT = 220

// ปัดค่าสูงสุดของแกนเป็นเลขกลม ๆ (1, 2, 5, 10, 20, ...) ให้อ่าน tick ง่าย
const niceCeil = (n: number) => {
  if (n <= 1) return 1
  const mag = 10 ** Math.floor(Math.log10(n))
  return ([1, 2, 5, 10].find((m) => n <= m * mag) ?? 10) * mag
}

// แท่งแนวตั้ง series เดียว ไม่มี legend เพราะแท็บบอกอยู่แล้วว่าแสดงอะไร
// ตัวชี้วัดแต่ละตัวขนาดตัวเลขต่างกันมาก จึงสลับดูทีละตัว ไม่เอามารวมแกนเดียว
export function ColumnChart({ metrics, days }: { metrics: ColumnMetric[]; days: number }) {
  const [metricKey, setMetricKey] = useState(metrics[0]?.key)
  const [hover, setHover] = useState<number | null>(null)
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0]
  if (!metric) return null

  const { points, unit, label } = metric
  const max = niceCeil(Math.max(0, ...points.map((p) => p.value)))
  const total = points.reduce((sum, p) => sum + p.value, 0)
  const ticks = max >= 2 ? [max, max / 2, 0] : [max, 0]
  const hovered = hover === null ? undefined : points[hover]
  const last = points.length - 1
  // ป้ายวันจอเล็กเหลือต้น กลาง ท้าย ไม่ให้ชนกัน จอใหญ่เพิ่มอีกสองจุด
  const xLabels = [
    { i: 0, always: true },
    { i: Math.round(last / 4), always: false },
    { i: Math.round(last / 2), always: true },
    { i: Math.round((last * 3) / 4), always: false },
    { i: last, always: true },
  ]

  return (
    <figure>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <figcaption className="text-sm text-slate-500">
          รวม {days} วัน <span className="text-lg font-semibold text-slate-900">{total.toLocaleString('th-TH')}</span> {unit}
        </figcaption>
        <div role="group" aria-label="เลือกข้อมูลที่จะดู" className="flex rounded-lg bg-slate-100 p-0.5 text-sm">
          {metrics.map((m) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={m.key === metric.key}
              onClick={() => {
                setMetricKey(m.key)
                setHover(null)
              }}
              className={`rounded-md px-3 py-1 whitespace-nowrap transition-colors ${
                m.key === metric.key ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 flex gap-2">
        {/* แกน y */}
        <div className="relative w-7 shrink-0 text-right text-[11px] text-slate-500 tabular-nums" style={{ height: HEIGHT }}>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / max) * 100}%` }}>
              {t.toLocaleString('th-TH')}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height: HEIGHT }} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 border-t border-slate-100" style={{ top: `${(1 - t / max) * 100}%` }} />
            ))}
            {total === 0 && (
              <p className="absolute inset-0 grid place-items-center text-sm text-slate-500">ยังไม่มีข้อมูลในช่วงนี้</p>
            )}
            {/* แต่ละช่องทั้งแนวสูงเป็นพื้นที่ hover ใหญ่กว่าตัวแท่ง วันที่ค่าน้อยจะได้ชี้ถึงง่าย */}
            <div className="absolute inset-0 flex items-end gap-0.5" role="img" aria-label={`${label} รวม ${total} ${unit} ใน ${days} วัน`}>
              {points.map((p, i) => (
                <div key={p.label} className="flex h-full flex-1 items-end justify-center" onMouseEnter={() => setHover(i)}>
                  {/* แท่งที่ไม่ได้ชี้จางลงตอน hover เท่านั้น ปกติต้องตัดกับพื้นขาวเกิน 3:1 */}
                  <div
                    className={`w-full max-w-6 rounded-t transition-colors ${hover === null ? 'bg-brand-600/85' : hover === i ? 'bg-brand-600' : 'bg-brand-600/35'}`}
                    style={{ height: `${(p.value / max) * 100}%` }}
                  />
                </div>
              ))}
            </div>

            {hovered && hover !== null && (
              // เลื่อนกล่องตามตำแหน่งแท่ง แท่งริมซ้ายขวากล่องจะได้ไม่ล้นออกนอกการ์ด
              <div
                className="pointer-events-none absolute z-10 rounded-lg bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg ring-1 ring-slate-200"
                style={{
                  left: `${((hover + 0.5) / points.length) * 100}%`,
                  bottom: `calc(${(hovered.value / max) * 100}% + 8px)`,
                  transform: `translateX(-${((hover + 0.5) / points.length) * 100}%)`,
                }}
              >
                <span className="font-semibold text-slate-900 tabular-nums">{hovered.value.toLocaleString('th-TH')}</span> {unit}
                <span className="ml-1.5 text-slate-500">{hovered.label}</span>
              </div>
            )}
          </div>

          <div className="relative mt-1.5 h-4 text-[11px] text-slate-500">
            {xLabels.map(({ i, always }) => {
              const point = points[i]
              if (!point) return null
              const edge = i === 0 ? 'left-0' : i === last ? 'right-0' : '-translate-x-1/2'
              return (
                <span
                  key={i}
                  className={`absolute whitespace-nowrap ${edge} ${always ? '' : 'hidden sm:inline'}`}
                  style={i !== 0 && i !== last ? { left: `${((i + 0.5) / points.length) * 100}%` } : undefined}
                >
                  {point.label}
                </span>
              )
            })}
          </div>
        </div>
      </div>

      {/* ตารางให้คนที่ใช้ screen reader หรืออยากเห็นตัวเลขทุกวัน tooltip อย่างเดียวไม่พอ */}
      <details className="mt-3 text-xs text-slate-500">
        <summary className="cursor-pointer hover:text-slate-700">ดูเป็นตาราง</summary>
        <table className="mt-2 w-full">
          <tbody className="divide-y divide-slate-100">
            {points.map((p) => (
              <tr key={p.label}>
                <td className="py-1">{p.label}</td>
                <td className="py-1 text-right text-slate-700 tabular-nums">{p.value.toLocaleString('th-TH')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

import { useState } from 'react'

export type DonutItem = { id: string; label: string; value: number; muted?: boolean }

// แดงนำตามแบรนด์ อีก 3 สีผ่าน validator ของ dataviz ครบทุกคู่ (ตาบอดสี ΔE ≥ 9) สีที่ 5 ไม่ผ่าน จึงรวมที่เหลือเป็น "อื่น ๆ"
// เหลืองกับเขียวตัดกับพื้นขาวไม่ถึง 3:1 ค่าจึงต้องอยู่ในรายการข้างวงเสมอ อ่านจากสีอย่างเดียวไม่ได้
const SLICE_COLORS = ['var(--color-brand-600)', '#2a78d6', '#eda100', '#1baf7a']
const OTHER_COLOR = '#94a3b8'
const OTHER_ID = 'other'

const RADIUS = 48
const STROKE = 14
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
// ช่องว่างระหว่างชิ้นประมาณ 2px เมื่อวงกว้าง 176px
const GAP = 1.4

const percent = (value: number, total: number) => {
  const share = (value / total) * 100
  return share > 0 && share < 1 ? '<1%' : `${Math.round(share)}%`
}

// ไล่สีตามอันดับ เกมเปลี่ยนอันดับแล้วสีเปลี่ยนตามได้ ชื่อเกมจึงต้องอยู่ข้างสีเสมอ ไม่ให้จำเกมจากสี
const toSlices = (items: DonutItem[]) => {
  const ranked = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value)
  const slices = ranked.slice(0, SLICE_COLORS.length).map((item, i) => ({ ...item, color: SLICE_COLORS[i] ?? OTHER_COLOR }))
  const rest = ranked.slice(SLICE_COLORS.length)
  if (rest.length > 0) {
    slices.push({
      id: OTHER_ID,
      label: `อื่น ๆ (${rest.length.toLocaleString('th-TH')} เกม)`,
      value: rest.reduce((sum, item) => sum + item.value, 0),
      color: OTHER_COLOR,
    })
  }
  return slices
}

type Props = { items: DonutItem[]; unit: string; emptyText: string }

export function DonutChart({ items, unit, emptyText }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const slices = toSlices(items)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const active = slices.find((slice) => slice.id === activeId)

  const toArcLength = (value: number) => (value / total) * CIRCUMFERENCE
  // แต่ละชิ้นเริ่มต่อจากผลรวมของชิ้นก่อนหน้า
  const arcs = slices.map((slice, i) => ({
    slice,
    length: toArcLength(slice.value),
    start: toArcLength(slices.slice(0, i).reduce((sum, s) => sum + s.value, 0)),
  }))

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col" onMouseLeave={() => setActiveId(null)}>
      <div className="relative size-44 shrink-0">
        <svg
          viewBox="0 0 120 120"
          role="img"
          aria-label={`สัดส่วน${unit}ตามเกม รวม ${total.toLocaleString('th-TH')} ${unit}`}
          className="size-full -rotate-90"
        >
          {/* วงพื้นให้เห็นรูปโดนัทตอนยังไม่มีข้อมูล */}
          {total === 0 && <circle cx="60" cy="60" r={RADIUS} fill="none" strokeWidth={STROKE} className="stroke-slate-100" />}
          {arcs.map(({ slice, length, start }) => (
            <circle
              key={slice.id}
              cx="60"
              cy="60"
              r={RADIUS}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE}
              // เกมเดียวเต็มวง ไม่ต้องมีช่องว่าง
              strokeDasharray={`${slices.length > 1 ? Math.max(length - GAP, 0.5) : length} ${CIRCUMFERENCE}`}
              strokeDashoffset={-start}
              onMouseEnter={() => setActiveId(slice.id)}
              className={`transition-opacity ${active && active.id !== slice.id ? 'opacity-30' : ''}`}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center px-8 text-center">
          <div className="truncate text-xs text-slate-500">{active ? active.label : `${unit}ทั้งหมด`}</div>
          <div className="text-2xl font-semibold text-slate-900">{(active ? active.value : total).toLocaleString('th-TH')}</div>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-sm text-slate-500">{emptyText}</p>
      ) : (
        <ul className="w-full min-w-0 space-y-0.5 text-sm">
          {slices.map((slice) => (
            <li
              key={slice.id}
              onMouseEnter={() => setActiveId(slice.id)}
              className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${active?.id === slice.id ? 'bg-slate-100' : ''}`}
            >
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
              <span className={`min-w-0 flex-1 truncate ${slice.muted ? 'text-slate-500' : 'text-slate-700'}`}>
                {slice.label}
                {slice.muted && <span className="ml-1 text-xs">(ปิดอยู่)</span>}
              </span>
              <span className="font-medium text-slate-900 tabular-nums">{slice.value.toLocaleString('th-TH')}</span>
              {/* whitespace-nowrap: 100% เกือบเต็มช่อง ถ้าปล่อยเครื่องหมาย % จะตกไปบรรทัดล่าง */}
              <span className="w-11 shrink-0 text-right whitespace-nowrap text-slate-500 tabular-nums">{percent(slice.value, total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

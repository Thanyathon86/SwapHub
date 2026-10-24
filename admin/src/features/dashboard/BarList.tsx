// แท่งแนวนอนสำหรับเทียบจำนวนตามหมวด ใช้สีเดียวกับ ColumnChart เพราะเป็น series เดียว
const BAR_COLOR = '#4f46e5'

export type BarItem = { id: string; label: string; value: number; muted?: boolean }

export function BarList({ items, unit }: { items: BarItem[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} title={`${item.label}: ${item.value} ${unit}`}>
          <div className="flex justify-between gap-3 text-sm">
            <span className={item.muted ? 'text-slate-400' : 'text-slate-700'}>
              {item.label}
              {item.muted && <span className="ml-1 text-xs">(ปิดอยู่)</span>}
            </span>
            {/* ค่าใช้สีตัวอักษรปกติ ไม่ใช้สีของแท่ง */}
            <span className="font-medium text-slate-800 tabular-nums">{item.value.toLocaleString('th-TH')}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            {item.value > 0 && (
              <div
                className="h-2 rounded-full"
                style={{ width: `${(item.value / max) * 100}%`, backgroundColor: BAR_COLOR }}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

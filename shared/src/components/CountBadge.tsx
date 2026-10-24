// ตัวเลขสิ่งที่รอให้ทำ แสดงเฉพาะเมื่อมากกว่า 0 ไม่ให้เมนูรกตอนไม่มีอะไรค้าง
export function CountBadge({ count, label }: { count: number | undefined; label: string }) {
  if (!count) return null
  return (
    <span
      aria-label={`${label} ${count} รายการ`}
      className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] leading-5 font-semibold text-white tabular-nums"
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

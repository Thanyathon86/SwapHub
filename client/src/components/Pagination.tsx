type Props = { page: number; total: number; pageSize: number; onChange: (page: number) => void }

export function Pagination({ page, total, pageSize, onChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) return null
  return (
    <nav className="flex items-center justify-center gap-3 pt-4 text-sm">
      <button type="button" className="btn btn-secondary" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        ก่อนหน้า
      </button>
      <span className="text-zinc-500 tabular-nums">
        {page} / {totalPages}
      </span>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        ถัดไป
      </button>
    </nav>
  )
}

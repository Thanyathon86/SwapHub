export function Spinner() {
  return (
    <div role="status" className="flex justify-center py-16">
      <div className="size-7 animate-spin rounded-full border-2 border-zinc-200 border-t-brand-600" />
      <span className="sr-only">กำลังโหลด</span>
    </div>
  )
}

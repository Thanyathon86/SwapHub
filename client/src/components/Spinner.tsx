export function Spinner() {
  return (
    <div role="status" className="flex justify-center py-16">
      <div className="size-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      <span className="sr-only">กำลังโหลด</span>
    </div>
  )
}

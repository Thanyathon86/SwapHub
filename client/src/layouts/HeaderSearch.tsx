import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { SearchIcon } from '../components/icons'

// ค้นหาได้จากทุกหน้า ผลลัพธ์ไปอยู่ที่หน้าเรียกดู
export function HeaderSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const onBrowse = location.pathname === '/browse'
  const current = onBrowse ? (new URLSearchParams(location.search).get('q') ?? '') : ''

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = String(new FormData(e.currentTarget).get('q')).trim()
    // อยู่หน้าเรียกดูแล้วให้ค้นต่อจากตัวกรองเดิม มาจากหน้าอื่นเริ่มค้นใหม่
    const next = new URLSearchParams(onBrowse ? location.search : '')
    next.delete('page')
    if (q) next.set('q', q)
    else next.delete('q')
    navigate(`/browse?${next.toString()}`)
  }

  return (
    <form role="search" onSubmit={onSubmit} className="relative min-w-0 flex-1 lg:max-w-xl">
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-500" />
      {/* key: ล้างหรือเปลี่ยนคำค้นจาก URL (เช่น กด back) แล้วช่องนี้ต้องตรงกับผลที่แสดง */}
      <input
        key={current}
        name="q"
        type="search"
        defaultValue={current}
        maxLength={100}
        aria-label="ค้นหาการ์ด"
        placeholder="ค้นหาการ์ด ชุด หรือเลขการ์ด"
        className="input rounded-full border-transparent bg-zinc-100 py-2 pl-10 text-ellipsis focus:bg-white"
      />
    </form>
  )
}

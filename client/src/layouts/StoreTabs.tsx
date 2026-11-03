import { Link, useLocation } from 'react-router'
import { marketLinks } from './marketLinks'

const kinds = ['SINGLE', 'GRADED', 'SEALED']

// NavLink เทียบแค่ path แยกแท็บที่ต่างกันเฉพาะ query ไม่ได้ จึงคิดแท็บที่เลือกจาก URL เอง
const activeKey = (pathname: string, search: string) => {
  if (pathname === '/') return 'latest'
  if (pathname !== '/browse') return null
  const params = new URLSearchParams(search)
  const kind = params.get('itemKind')
  if (kind && kinds.includes(kind)) return kind
  return params.get('type') === 'TRADE' ? 'TRADE' : 'all'
}

// จอใหญ่ติดบนสุดตอนเลื่อน จอเล็กไม่ต้องติด เพราะมี BottomNav อยู่แล้วและพื้นที่แนวตั้งมีค่ากว่า
export function StoreTabs() {
  const { pathname, search } = useLocation()
  const active = activeKey(pathname, search)

  return (
    <nav
      aria-label="หมวดตลาด"
      className="z-20 border-y border-zinc-100 bg-white shadow-[0_8px_16px_-12px_rgb(0_0_0/0.2)] lg:sticky lg:top-0"
    >
      <ul className="no-scrollbar flex gap-1 overflow-x-auto px-3 py-1.5 sm:px-4 md:justify-center lg:gap-2">
        {marketLinks.map((link) => (
          <li key={link.key} className="shrink-0">
            <Link
              to={link.to}
              aria-current={active === link.key ? 'page' : undefined}
              className={`block rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition lg:py-1 lg:text-[15px] ${active === link.key ? 'bg-brand-50 text-brand-600' : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'}`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

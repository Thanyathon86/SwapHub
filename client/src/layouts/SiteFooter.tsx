import { Link } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { LogoFull } from '@shared/brand/Logo'
import { marketLinks } from './marketLinks'

type FooterLink = { label: string; to: string }

// คิดครั้งเดียวตอนโหลดไฟล์ ไม่ต้องคำนวณใหม่ทุก render
const YEAR = new Date().getFullYear()

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-zinc-800">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm text-zinc-600">
        {links.map((link) => (
          <li key={link.to}>
            <Link to={link.to} className="hover:text-brand-600 hover:underline">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ใส่เฉพาะลิงก์ที่มีหน้าจริง ยังไม่มีหน้านโยบายหรือเงื่อนไขการใช้งาน จึงไม่ใส่ลิงก์เปล่าไว้
export function SiteFooter() {
  const { user } = useAuth()
  const account: FooterLink[] = user
    ? [
        { label: 'ลงประกาศ', to: '/sell' },
        { label: 'ประกาศของฉัน', to: '/my-listings' },
        { label: 'ข้อเสนอ', to: '/offers' },
        { label: 'ตั้งค่าบัญชี', to: '/settings' },
      ]
    : [
        { label: 'เข้าสู่ระบบ', to: '/login' },
        { label: 'สมัครสมาชิก', to: '/register' },
      ]

  return (
    <footer className="border-t-4 border-brand-600 bg-zinc-100">
      <div className="page-container py-8 lg:py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div className="col-span-2 flex items-center gap-4 sm:col-span-3 lg:col-span-1 lg:items-start">
            <Link to="/" aria-label="TCGNexus หน้าแรก" className="shrink-0 rounded-2xl">
              <LogoFull />
            </Link>
            <div>
              <p className="text-xl font-bold tracking-tight text-zinc-900">
                TCG<span className="text-brand-600">Nexus</span>
              </p>
              <p className="mt-1 max-w-xs text-sm text-zinc-600">ตลาดซื้อขายแลกเปลี่ยนการ์ดเกม ทีมงานตรวจทุกประกาศก่อนขึ้นตลาด</p>
            </div>
          </div>
          <FooterColumn title="ตลาด" links={marketLinks} />
          <FooterColumn title="บัญชี" links={account} />
          <FooterColumn title="ช่วยเหลือ" links={[{ label: 'ติดต่อทีมงาน', to: '/support' }]} />
        </div>
        <p className="mt-8 border-t border-zinc-300 pt-5 text-xs text-zinc-500 lg:mt-10">© {YEAR} TCGNexus</p>
      </div>
    </footer>
  )
}

import { Link } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'

const steps = [
  { title: 'ลงประกาศ', detail: 'กรอกข้อมูลการ์ด ตั้งราคา หรือบอกว่าอยากแลกอะไร' },
  { title: 'ทีมงานตรวจ', detail: 'ผ่านแล้วประกาศจะขึ้นตลาดให้ทุกคนเห็น' },
  { title: 'รับข้อเสนอ', detail: 'คุยรายละเอียดในแชท ตกลงแล้วให้คะแนนกัน' },
]

// อธิบายขั้นตอนจริงของระบบ คนที่ยังไม่เคยขายจะได้รู้ว่าลงแล้วเกิดอะไรต่อ
export function SellBanner() {
  const { user } = useAuth()

  return (
    <section aria-labelledby="sell-title" className="bg-zinc-100">
      <div className="page-container grid items-center gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-8 lg:py-14">
        <div>
          <h2 id="sell-title" className="text-2xl/tight font-semibold text-zinc-800 sm:text-3xl/tight lg:text-4xl/tight">
            มีการ์ดอยากปล่อย?
          </h2>
          <p className="mt-2 max-w-md text-zinc-600 sm:mt-3">ลงขายหรือลงแลกการ์ดที่ไม่ได้ใช้ แล้วรอรับข้อเสนอจากนักสะสมคนอื่น</p>
          <Link to={user ? '/sell' : '/register'} className="btn btn-primary mt-5 px-6 py-2.5 sm:mt-6">
            ลงประกาศ
          </Link>
        </div>
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-3 rounded-xl bg-white p-4 shadow-sm sm:block">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white tabular-nums">
                {i + 1}
              </div>
              <div>
                <div className="font-semibold text-zinc-800 sm:mt-2">{step.title}</div>
                <p className="mt-1 text-sm text-zinc-600">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

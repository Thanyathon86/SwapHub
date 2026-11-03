import { Link } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { LogoFull } from '@shared/brand/Logo'
import { ShieldCheckIcon } from '../../components/icons'

const cardClass = '-ml-[9%] w-[26%] max-w-48 rounded-2xl p-1 first:ml-0 lg:p-1.5'

// ดาวกับลายจุดหยิบมาจากลายคอมิกในโลโก้ แทนการวางโลโก้ซ้ำทุกใบ
// ใบข้างถูกใบที่อยู่ด้านในทับราวหนึ่งในสาม ดาวจึงเยื้องออกด้านนอก ไม่ให้โดนบังครึ่งหนึ่ง
function CardBack({ className, starClass }: { className: string; starClass: string }) {
  return (
    <div className={`${cardClass} ${className} bg-brand-800 shadow-xl shadow-black/30 ring-1 ring-white/15 ring-inset`}>
      <div className="relative aspect-[63/88]">
        <div className="absolute inset-[4%] rounded-lg bg-[radial-gradient(rgb(255_255_255/0.2)_1.1px,transparent_1.7px)] bg-size-[9px_9px] ring-1 ring-white/20 ring-inset" />
        <svg viewBox="0 0 100 100" className={`absolute top-1/2 w-[58%] -translate-y-1/2 fill-brand-600 ${starClass}`}>
          <polygon points="50,4 56.9,33.4 82.5,17.5 66.6,43.1 96,50 66.6,56.9 82.5,82.5 56.9,66.6 50,96 43.1,66.6 17.5,82.5 33.4,56.9 4,50 33.4,43.1 17.5,17.5 43.1,33.4" />
        </svg>
      </div>
    </div>
  )
}

// ระยะเลื่อนเป็น % พัดจึงคงรูปเมื่อการ์ดย่อตามจอ
function CardFan() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center">
      <CardBack className="z-0 -rotate-[14deg] translate-y-[13%]" starClass="left-[2%]" />
      <CardBack className="z-[1] -rotate-[7deg] translate-y-[3%]" starClass="left-[2%]" />
      {/* @container: ชื่อแบรนด์ย่อตามขนาดการ์ด จอเล็กจะได้ไม่ล้นกรอบ */}
      <div className={`${cardClass} @container z-[2] scale-[1.18] bg-white shadow-2xl shadow-black/40`}>
        <div className="flex aspect-[63/88] flex-col items-center justify-center gap-[3cqw]">
          <LogoFull className="w-full" />
          <div className="text-[length:11.5cqw] font-bold tracking-tight text-zinc-900">
            TCG<span className="text-brand-600">Nexus</span>
          </div>
        </div>
      </div>
      <CardBack className="z-[1] rotate-[7deg] translate-y-[3%]" starClass="right-[2%]" />
      <CardBack className="z-0 rotate-[14deg] translate-y-[13%]" starClass="right-[2%]" />
    </div>
  )
}

// เว้นระยะไม่เท่ากันแบบลายระเบิดในโลโก้ ถ้าเท่ากันหมดจะไปคล้ายธงอาทิตย์อุทัย
const BURST_RAYS = [
  [0, 5], [17, 25], [38, 41], [52, 61], [75, 80], [93, 99], [112, 121], [133, 136], [150, 158], [171, 176],
  [189, 198], [208, 211], [226, 234], [246, 251], [263, 272], [282, 285], [300, 308], [321, 326], [338, 347],
] as const

const burst = `conic-gradient(${BURST_RAYS.map(([from, to]) => `transparent 0 ${from}deg, rgb(0 0 0 / 0.12) 0 ${to}deg`).join(', ')}, transparent 0)`

// ตัวเลขน้อย ๆ ทำให้ตลาดดูร้างเหมือนขึ้น "0 ประกาศ" จึงแสดงเมื่อมีประกาศมากพอแล้ว
const MIN_TOTAL_SHOWN = 20

type Props = {
  // undefined = กำลังโหลด
  total: number | undefined
}

// ภาพหลักเป็นการ์ดของแบรนด์ ไม่ดึงรูปจากประกาศ เพราะหน้าแรกคุมคุณภาพรูปของผู้ขายไม่ได้
export function HomeHero({ total }: Props) {
  const { user } = useAuth()
  const showTotal = total !== undefined && total >= MIN_TOTAL_SHOWN

  return (
    // isolate: z-index ของการ์ดในพัดต้องไม่ลอยทับแท็บที่ติดอยู่ด้านบนตอนเลื่อน
    <section aria-labelledby="home-title" className="isolate overflow-hidden bg-brand-600 text-white">
      <div className="page-container grid items-center gap-5 py-7 sm:py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8 lg:py-12">
        <div>
          <p className="text-sm font-medium sm:text-base">ตลาดการ์ดเกมสำหรับนักสะสม</p>
          {/* md แบ่งสองคอลัมน์ ความกว้างลดลงกว่า sm จึงต้องลดขนาดตัวหนังสือลงก่อน แล้วค่อยขยายตามจอ */}
          <h1 id="home-title" className="mt-2 text-4xl/tight font-medium sm:text-5xl/tight md:text-4xl/tight lg:text-5xl/tight xl:text-6xl/tight">
            ซื้อ ขาย แลก
            <br />
            {/* ภาษาไทยไม่มีช่องว่างให้ตัดคำ ถ้าปล่อยจะขึ้นบรรทัดใหม่กลางคำ */}
            <span className="font-bold whitespace-nowrap">การ์ดใบที่ตามหา</span>
          </h1>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:flex">
            {/* ปุ่มหลักสีแดงกลืนกับพื้น จึงกลับสีเฉพาะบนแถบนี้ และกรอบตอนโฟกัสต้องเป็นสีขาวถึงจะเห็น */}
            <Link to="/browse" className="btn bg-white px-6 py-3 font-semibold text-brand-600 hover:bg-brand-50 focus-visible:outline-white">
              เรียกดูการ์ด
            </Link>
            <Link
              to={user ? '/sell' : '/register'}
              className="btn px-6 py-3 font-semibold text-white ring-1 ring-white/75 hover:bg-white/10 focus-visible:outline-white"
            >
              ลงประกาศ
            </Link>
          </div>
          <p className="mt-4 flex items-start gap-2 text-sm">
            <ShieldCheckIcon className="size-5 shrink-0" />
            <span className="min-w-0">
              ทีมงานตรวจทุกประกาศก่อนขึ้นตลาด{' '}
              {/* จอเล็กขึ้นบรรทัดใหม่ทั้งก้อน ไม่ให้เหลือคำว่า "ประกาศ" ค้างอยู่บรรทัดล่างคำเดียว */}
              {showTotal && <span className="whitespace-nowrap">· เปิดอยู่ {total.toLocaleString('th-TH')} ประกาศ</span>}
            </span>
          </p>
        </div>
        {/* pb เผื่อการ์ดริมที่เลื่อนต่ำลง ซึ่งไม่นับในความสูงของ layout ไม่งั้นจะล้นขอบแถบ */}
        <div className="relative pt-[2%] pb-[8%]">
          {/* ผูกจุดศูนย์กลางไว้กับพัด รัศมีจึงพุ่งจากหลังการ์ดเสมอไม่ว่าจอจะกว้างแค่ไหน */}
          <div
            aria-hidden="true"
            style={{ backgroundImage: burst }}
            className="absolute top-1/2 left-1/2 -z-10 size-[56rem] -translate-x-1/2 -translate-y-1/2 [mask-image:radial-gradient(closest-side,black_16%,transparent_80%)] md:size-[88rem]"
          />
          <CardFan />
        </div>
      </div>
    </section>
  )
}

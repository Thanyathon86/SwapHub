import { Link } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { ListingCover } from '@shared/listings/ListingCover'
import type { Listing } from '@shared/listings/listingsApi'

// ตำแหน่งการ์ดในพัด ไล่จากซ้ายไปขวา ใบกลางอยู่บนสุด
const FAN_SLOTS = [
  '-rotate-[14deg] translate-y-8',
  '-rotate-[7deg] translate-y-2',
  'z-10',
  'rotate-[7deg] translate-y-2',
  'rotate-[14deg] translate-y-8',
]

function CardFan({ listings }: { listings: Listing[] }) {
  const shown = listings.slice(0, FAN_SLOTS.length)
  // มีการ์ดไม่ครบก็ยังเรียงจากตรงกลาง พัดไม่เอียงไปข้างเดียว
  const firstSlot = Math.floor((FAN_SLOTS.length - shown.length) / 2)
  return (
    <div className="flex items-center justify-center">
      {shown.map((listing, i) => (
        <Link
          key={listing.id}
          to={`/listings/${listing.id}`}
          aria-label={listing.title}
          className={`-ml-[9%] w-[26%] max-w-48 overflow-hidden rounded-xl shadow-2xl shadow-black/40 ring-1 ring-black/10 transition duration-300 first:ml-0 hover:z-20 hover:-translate-y-3 focus-visible:outline-white motion-reduce:transition-none ${FAN_SLOTS[firstSlot + i]}`}
        >
          <ListingCover listing={listing} />
        </Link>
      ))}
    </div>
  )
}

type Props = {
  // undefined = กำลังโหลด
  listings: Listing[] | undefined
  total: number | undefined
}

// ไม่มีระบบแคมเปญ จึงใช้การ์ดจริงจากประกาศล่าสุดเป็นภาพหลัก แทนการแต่งโปรโมชันขึ้นมาเอง
export function HomeHero({ listings, total }: Props) {
  const { user } = useAuth()
  const hasListings = listings === undefined || listings.length > 0

  return (
    <section aria-labelledby="home-title">
      {/* isolate: z-index ของการ์ดในพัดต้องไม่ลอยทับแท็บที่ติดอยู่ด้านบนตอนเลื่อน */}
      <div className="relative isolate overflow-hidden bg-brand-600 text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(60rem_30rem_at_82%_-10%,rgb(255_255_255/0.2),transparent),radial-gradient(44rem_26rem_at_100%_115%,rgb(122_0_9/0.65),transparent)]"
        />
        <div className="page-container relative grid items-center gap-4 py-8 sm:py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-8 lg:py-14">
          <div>
            <p className="text-sm font-medium sm:text-base">ตลาดการ์ดเกมสำหรับนักสะสม</p>
            {/* md แบ่งสองคอลัมน์ ความกว้างลดลงกว่า sm จึงต้องลดขนาดตัวหนังสือลงก่อน แล้วค่อยขยายตามจอ */}
            <h1
              id="home-title"
              className="mt-2 text-4xl/tight font-medium sm:mt-3 sm:text-5xl/tight md:text-4xl/tight lg:text-5xl/tight xl:text-6xl/tight"
            >
              ซื้อ ขาย แลก
              <br />
              {/* ภาษาไทยไม่มีช่องว่างให้ตัดคำ ถ้าปล่อยจะขึ้นบรรทัดใหม่กลางคำ */}
              <span className="font-bold whitespace-nowrap">การ์ดใบที่ตามหา</span>
            </h1>
          </div>
          {/* จองความสูงไว้ก่อนข้อมูลมาถึง ไม่ให้เนื้อหาด้านล่างกระโดด */}
          {hasListings && (
            <div className="flex min-h-48 items-center sm:min-h-64 md:min-h-52 lg:min-h-80">
              <div className="w-full">{listings && <CardFan listings={listings} />}</div>
            </div>
          )}
        </div>
      </div>
      <div className="relative shadow-[0_12px_24px_-16px_rgb(0_0_0/0.2)]">
        <div className="page-container flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {/* ยังไม่รู้จำนวนหรือยังไม่มีประกาศ ไม่ต้องขึ้น "0 ประกาศ" ให้ดูว่าตลาดร้าง */}
            <p className="section-title">{total ? `เปิดอยู่ ${total.toLocaleString('th-TH')} ประกาศ` : 'ตลาดการ์ดของนักสะสม'}</p>
            <p className="mt-1 text-sm text-zinc-500">ทีมงานตรวจทุกประกาศก่อนขึ้นตลาด</p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex">
            <Link to="/browse" className="btn btn-primary px-5 py-2.5">
              เรียกดูการ์ด
            </Link>
            <Link to={user ? '/sell' : '/register'} className="btn btn-secondary px-5 py-2.5">
              ลงประกาศ
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { Listing } from '@shared/listings/listingsApi'
import { ChevronIcon } from '../../components/icons'
import { ListingCard, ListingCardSkeleton } from './ListingCard'

const ROW_SIZE = 12
const SKELETON_COUNT = 6
const GAP_PX = 16

// จอเล็กให้เห็นใบถัดไปบางส่วน เป็นสัญญาณว่าเลื่อนต่อได้ เพราะไม่มีปุ่มลูกศร
const tileClass =
  'w-[42%] shrink-0 snap-start sm:w-[28%] md:w-[calc((100%-3rem)/4)] lg:w-[calc((100%-4rem)/5)] xl:w-[calc((100%-5rem)/6)]'

type Props = {
  title: string
  // ลิงก์ "ดูทั้งหมด" ไปหน้าเรียกดูพร้อมตัวกรองของแถวนี้
  to: string
  // undefined = กำลังโหลด แสดงโครงการ์ดไว้ก่อน
  listings: Listing[] | undefined
}

export function ListingRow({ title, to, listings }: Props) {
  const titleId = useId()
  const scroller = useRef<HTMLUListElement>(null)
  // แยกเป็น boolean สองตัว ค่าไม่เปลี่ยนแล้ว React ไม่ render ซ้ำ ไม่ต้อง render ทั้งแถวทุก scroll event
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(true)

  const measure = useCallback(() => {
    const el = scroller.current
    if (!el) return
    // เผื่อ 1px เพราะ scrollLeft เป็นทศนิยมได้ตอนซูมหน้าจอ
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    // ทำงานครั้งแรกทันทีที่เริ่ม observe และทุกครั้งที่จอเปลี่ยนขนาด (จำนวนใบที่เห็นเปลี่ยนตาม)
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure, listings])

  const scrollPage = (direction: 1 | -1) => {
    const el = scroller.current
    if (!el) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: direction * (el.clientWidth + GAP_PX), behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  const arrowClass =
    'absolute top-[38%] z-10 hidden size-10 -translate-y-1/2 place-items-center rounded-full bg-white text-brand-600 shadow-lg ring-1 ring-black/5 transition hover:bg-brand-600 hover:text-white md:grid'

  return (
    <section aria-labelledby={titleId}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={titleId} className="section-title">
          {title}
        </h2>
        <Link to={to} className="link-accent shrink-0">
          ดูทั้งหมด
        </Link>
      </div>
      <div className="relative mt-4">
        <ul
          ref={scroller}
          onScroll={measure}
          // ระยะ 1 หน่วยรอบแถวเผื่อกรอบ focus ของการ์ด ไม่งั้น overflow จะตัดกรอบทิ้ง
          className="no-scrollbar -mx-4 -my-1 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 py-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 md:-mx-1 md:scroll-px-1 md:px-1"
        >
          {listings
            ? listings.slice(0, ROW_SIZE).map((listing) => (
                <li key={listing.id} className={tileClass}>
                  <ListingCard listing={listing} />
                </li>
              ))
            : Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <li key={i} className={tileClass}>
                  <ListingCardSkeleton />
                </li>
              ))}
        </ul>
        {!atStart && (
          <button
            type="button"
            aria-label={`เลื่อน${title}ย้อนกลับ`}
            onClick={() => scrollPage(-1)}
            className={`${arrowClass} -left-5`}
          >
            <ChevronIcon direction="left" className="size-5" />
          </button>
        )}
        {!atEnd && (
          <button
            type="button"
            aria-label={`เลื่อน${title}ไปข้างหน้า`}
            onClick={() => scrollPage(1)}
            className={`${arrowClass} -right-5`}
          >
            <ChevronIcon direction="right" className="size-5" />
          </button>
        )}
      </div>
    </section>
  )
}

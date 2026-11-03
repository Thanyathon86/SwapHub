import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { gradientFor } from '@shared/listings/gradient'
import { imageUrl, type CatalogGame } from '@shared/listings/listingsApi'
import { ChevronIcon } from '../../components/icons'

const SKELETON_COUNT = 3

// จอเล็กเห็นทีละ 2 ใบ จอใหญ่ทีละ 3 ใบ ตัวเลขใน calc ต้องตรงกับ gap ของแถว
const tileClass = 'aspect-[16/10] w-[calc((100%-0.75rem)/2)] shrink-0 snap-start rounded-xl sm:w-[calc((100%-2rem)/3)]'

const arrowClass =
  'absolute top-1/2 z-10 grid size-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-zinc-800 shadow-md ring-1 ring-black/10 transition hover:bg-white sm:size-10'

function GameTile({ game }: { game: CatalogGame }) {
  return (
    <Link
      to={`/browse?game=${encodeURIComponent(game.slug)}`}
      className={`group relative flex items-end overflow-hidden bg-linear-to-br p-3 text-white sm:p-4 lg:p-5 ${tileClass} ${gradientFor(game.slug)}`}
    >
      {game.imageKey ? (
        // alt ว่าง: ชื่อเกมเป็นข้อความอยู่ในลิงก์แล้ว สีพื้นด้านหลังแสดงระหว่างรูปกำลังโหลด
        <img
          src={imageUrl(game.imageKey)}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover transition duration-300 group-hover:scale-105 motion-reduce:transform-none"
        />
      ) : (
        <>
          <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.45),transparent_55%)]" />
          <span
            aria-hidden="true"
            className="absolute top-[12%] right-[6%] aspect-[63/88] h-[110%] rotate-12 rounded-lg bg-white/15 ring-1 ring-white/30 transition duration-300 group-hover:rotate-[16deg] motion-reduce:transition-none"
          />
          <span
            aria-hidden="true"
            className="absolute top-[22%] right-[24%] aspect-[63/88] h-[110%] -rotate-6 rounded-lg bg-white/20 ring-1 ring-white/30 transition duration-300 group-hover:-rotate-[10deg] motion-reduce:transition-none"
          />
        </>
      )}
      {/* พื้นบางเกมหรือรูปอาจสว่างมาก ต้องมีเงาไล่ระดับรองไว้ ตัวหนังสือสีขาวถึงจะอ่านออก */}
      <span
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t to-transparent ${game.imageKey ? 'from-black/60' : 'from-black/50'}`}
      />
      <span className="relative text-base/tight font-semibold [text-shadow:0_1px_8px_rgb(0_0_0/0.35)] sm:text-lg/tight lg:text-2xl/tight">
        {game.name}
      </span>
    </Link>
  )
}

// ระยะที่เลื่อนต่อหนึ่งหน้า อ่านจากขนาดจริง เพราะจำนวนใบที่เห็นเปลี่ยนตามความกว้างจอ
const measureRow = (row: HTMLElement) => {
  const first = row.firstElementChild as HTMLElement | null
  if (!first) return null
  const gap = Number.parseFloat(getComputedStyle(row).columnGap) || 0
  const step = first.offsetWidth + gap
  const perView = Math.max(1, Math.round((row.clientWidth + gap) / step))
  return { pageWidth: step * perView, pages: Math.ceil(row.children.length / perView) }
}

// แถวเดียวเลื่อนได้ เกมเพิ่มกี่เกมก็ไม่ทำให้หน้ายาวขึ้น
export function GameTiles({ games }: { games: CatalogGame[] | undefined }) {
  const titleId = useId()
  const row = useRef<HTMLDivElement>(null)
  const [pager, setPager] = useState({ page: 0, pages: 1 })

  const sync = useCallback(() => {
    const el = row.current
    const size = el && measureRow(el)
    if (!el || !size) return
    // หน้าสุดท้ายมักเลื่อนได้ไม่เต็มหน้า ถ้าสุดทางแล้วให้นับเป็นหน้าสุดท้ายเสมอ
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    const page = atEnd ? size.pages - 1 : Math.round(el.scrollLeft / size.pageWidth)
    // ค่าเดิมคืน object เดิม ไม่ให้ render ซ้ำทุก scroll event
    setPager((current) => (current.page === page && current.pages === size.pages ? current : { page, pages: size.pages }))
  }, [])

  useEffect(() => {
    const el = row.current
    if (!el) return
    // ทำงานครั้งแรกทันทีที่เริ่ม observe และทุกครั้งที่จอเปลี่ยนขนาด
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [sync, games])

  const goTo = (page: number) => {
    const el = row.current
    const size = el && measureRow(el)
    if (!el || !size) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: page * size.pageWidth, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  if (games?.length === 0) return null

  const { page, pages } = pager

  return (
    <section aria-labelledby={titleId}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={titleId} className="section-title">
          เกมยอดนิยม
        </h2>
        <Link to="/browse" className="link-accent shrink-0">
          ดูทั้งหมด
        </Link>
      </div>
      <div className="relative mt-4">
        {/* ระยะ 1 หน่วยรอบแถวเผื่อกรอบ focus ไม่งั้น overflow จะตัดทิ้ง center-safe: เกมน้อยจัดกึ่งกลาง แต่ไม่ถูกตัดตอนล้น */}
        <div
          ref={row}
          onScroll={sync}
          className="no-scrollbar -m-1 flex snap-x snap-mandatory scroll-px-1 justify-center-safe gap-3 overflow-x-auto p-1 sm:gap-4"
        >
          {games
            ? games.map((game) => <GameTile key={game.id} game={game} />)
            : Array.from({ length: SKELETON_COUNT }, (_, i) => (
                <div key={i} aria-hidden="true" className={`animate-pulse bg-zinc-100 motion-reduce:animate-none ${tileClass}`} />
              ))}
        </div>
        {page > 0 && (
          <button type="button" aria-label="เกมก่อนหน้า" onClick={() => goTo(page - 1)} className={`${arrowClass} left-2`}>
            <ChevronIcon direction="left" className="size-5" />
          </button>
        )}
        {page < pages - 1 && (
          <button type="button" aria-label="เกมถัดไป" onClick={() => goTo(page + 1)} className={`${arrowClass} right-2`}>
            <ChevronIcon direction="right" className="size-5" />
          </button>
        )}
      </div>
      {pages > 1 && (
        <div role="group" aria-label="หน้าของเกมยอดนิยม" className="mt-2 flex justify-center">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`หน้าที่ ${i + 1} จาก ${pages}`}
              aria-current={i === page ? 'true' : undefined}
              onClick={() => goTo(i)}
              // ตุ่มเล็ก 8px แต่พื้นที่กด 24px จะได้กดบนจอสัมผัสได้
              className="grid size-6 place-items-center rounded-full"
            >
              <span className={`size-2 rounded-full transition ${i === page ? 'bg-brand-600' : 'bg-zinc-300'}`} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

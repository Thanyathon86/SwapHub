import { Link, useSearchParams } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Pagination } from '@shared/components/Pagination'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'
import { kindLabel } from '@shared/listings/labels'
import {
  listingsApi,
  type BrowseQuery,
  type BrowseSort,
  type ItemKind,
  type ListingType,
} from '@shared/listings/listingsApi'
import { ListingCard, ListingCardSkeleton } from '../../features/listings/ListingCard'

const kinds: ItemKind[] = ['SINGLE', 'GRADED', 'SEALED']
const sorts: { value: BrowseSort; label: string }[] = [
  { value: 'newest', label: 'ล่าสุด' },
  { value: 'price_asc', label: 'ราคาต่ำ → สูง' },
  { value: 'price_desc', label: 'ราคาสูง → ต่ำ' },
]
const SKELETON_COUNT = 12
const gridClass = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

// ค่าใน URL แก้เองได้ กรองให้เหลือแต่ค่าที่ server รับ ไม่งั้นจะได้ VALIDATION_ERROR แทนผลค้นหา
const oneOf = <T extends string>(value: string | null, allowed: readonly T[]) =>
  allowed.includes(value as T) ? (value as T) : undefined

const parseQuery = (params: URLSearchParams): BrowseQuery => {
  const page = Number(params.get('page'))
  return {
    q: params.get('q') ?? undefined,
    game: params.get('game') ?? undefined,
    itemKind: oneOf(params.get('itemKind'), kinds),
    type: oneOf(params.get('type'), ['SALE', 'TRADE'] as const),
    sort: oneOf(params.get('sort'), ['newest', 'price_asc', 'price_desc'] as const),
    page: Number.isInteger(page) && page > 1 ? page : undefined,
  }
}

const titleOf = ({ q, itemKind, type }: BrowseQuery) => {
  if (q) return `ผลการค้นหา “${q}”`
  if (itemKind) return kindLabel[itemKind]
  if (type === 'TRADE') return 'รับแลก'
  if (type === 'SALE') return 'ซื้อได้'
  return 'การ์ดทั้งหมด'
}

// ลูกศรของ select กินพื้นที่อยู่แล้ว ลดระยะขวาเพื่อให้ข้อความไม่ถูกตัด
const selectClass = 'input rounded-full py-2 pr-1 pl-3 lg:w-auto lg:pr-2'

export default function BrowsePage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const query = parseQuery(params)
  const { data: games } = useResource(listingsApi.games)
  const { data, error, loading } = useResource(() => listingsApi.browse(query), params.toString())

  // เปลี่ยนตัวกรองแล้วกลับไปหน้า 1 เสมอ ยกเว้นตอนกดเปลี่ยนหน้าเอง
  const update = (next: Partial<Record<keyof BrowseQuery, string | number | undefined>>) => {
    const merged = { ...query, page: undefined, ...next }
    const p = new URLSearchParams()
    for (const [key, value] of Object.entries(merged)) {
      if (value !== undefined && value !== '') p.set(key, String(value))
    }
    // ตัวกรองอยู่บนสุดของหน้าอยู่แล้ว เลื่อนจอเฉพาะตอนเปลี่ยนหน้า ซึ่งกดจากท้ายรายการ
    setParams(p, { preventScrollReset: next.page === undefined })
  }

  const filtered = Boolean(query.q || query.game || query.itemKind || query.type)

  return (
    <div className="page-container space-y-5 pt-6 pb-12 sm:space-y-6 sm:pt-8 sm:pb-16">
      <div>
        <h1 className="page-title">{titleOf(query)}</h1>
        <div className="mt-2 flex min-h-5 flex-wrap items-center gap-x-4 text-sm text-zinc-500">
          {data && (
            <span>
              แสดง {data.listings.length.toLocaleString('th-TH')} จาก {data.total.toLocaleString('th-TH')} รายการ
            </span>
          )}
          {filtered && (
            <button type="button" className="link-accent" onClick={() => setParams({})}>
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      <section aria-label="ตัวกรอง" className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-0.5 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0.5">
          <button
            type="button"
            aria-pressed={!query.game}
            className={`chip ${!query.game ? 'chip-active' : ''}`}
            onClick={() => update({ game: undefined })}
          >
            ทุกเกม
          </button>
          {games?.map((game) => (
            <button
              key={game.id}
              type="button"
              aria-pressed={query.game === game.slug}
              className={`chip ${query.game === game.slug ? 'chip-active' : ''}`}
              onClick={() => update({ game: game.slug })}
            >
              {game.name}
            </button>
          ))}
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
          <select
            aria-label="ประเภทสินค้า"
            value={query.itemKind ?? ''}
            onChange={(e) => update({ itemKind: e.target.value || undefined })}
            // จอเล็กเลือกประเภทจากแท็บด้านบนได้อยู่แล้ว ซ่อนไว้ให้เหลือแถวเดียว การ์ดจะได้ขึ้นเร็ว
            className={`${selectClass} hidden sm:block`}
          >
            <option value="">ทุกประเภท</option>
            {kinds.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabel[kind]}
              </option>
            ))}
          </select>
          <select
            aria-label="ขายหรือแลก"
            value={query.type ?? ''}
            onChange={(e) => update({ type: (e.target.value || undefined) as ListingType | undefined })}
            className={selectClass}
          >
            <option value="">ขายและแลก</option>
            <option value="SALE">ซื้อได้</option>
            <option value="TRADE">รับแลก</option>
          </select>
          <select
            aria-label="เรียงตาม"
            value={query.sort ?? 'newest'}
            onChange={(e) => update({ sort: e.target.value === 'newest' ? undefined : e.target.value })}
            className={selectClass}
          >
            {sorts.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section aria-label="ผลลัพธ์">
        {error !== undefined && !data ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(error)}</p>
        ) : !data ? (
          <div className={gridClass}>
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </div>
        ) : data.listings.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-20 text-center">
            <p className="font-medium">{filtered ? 'ไม่พบประกาศที่ตรงกับตัวกรอง' : 'ยังไม่มีประกาศ'}</p>
            <p className="mt-1 text-sm text-zinc-500">
              {filtered ? 'ลองเปลี่ยนคำค้นหรือเลือกเกมอื่น' : 'มาเป็นคนแรกที่ลงการ์ดในตลาดนี้'}
            </p>
            {filtered ? (
              <button type="button" className="btn btn-secondary mt-6" onClick={() => setParams({})}>
                ล้างตัวกรอง
              </button>
            ) : (
              <Link to={user ? '/sell' : '/register'} className="btn btn-primary mt-6">
                ลงประกาศ
              </Link>
            )}
          </div>
        ) : (
          <div className={`space-y-8 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <div className={gridClass}>
              {data.listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
            <Pagination
              page={data.page}
              total={data.total}
              pageSize={data.pageSize}
              onChange={(page) => update({ page })}
            />
          </div>
        )}
      </section>
    </div>
  )
}

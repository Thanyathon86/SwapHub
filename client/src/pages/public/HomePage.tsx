import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Pagination } from '../../components/Pagination'
import { Spinner } from '../../components/Spinner'
import { useAuth } from '../../features/auth/useAuth'
import { kindLabel } from '../../features/listings/labels'
import { ListingCard } from '../../features/listings/ListingCard'
import {
  listingsApi,
  type BrowseQuery,
  type BrowseSort,
  type ItemKind,
  type ListingType,
} from '../../features/listings/listingsApi'
import { errorMessage } from '../../lib/api'
import { useResource } from '../../lib/useResource'

const kinds: ItemKind[] = ['SINGLE', 'GRADED', 'SEALED']
const sorts: { value: BrowseSort; label: string }[] = [
  { value: 'newest', label: 'ล่าสุด' },
  { value: 'price_asc', label: 'ราคาต่ำ → สูง' },
  { value: 'price_desc', label: 'ราคาสูง → ต่ำ' },
]

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

export default function HomePage() {
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
    setParams(p)
  }

  const onSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    update({ q: String(new FormData(e.currentTarget).get('q')).trim() })
  }

  const filtered = Boolean(query.q || query.game || query.itemKind || query.type)

  return (
    <div className="space-y-10">
      <section className="pt-6 sm:pt-12">
        <p className="text-sm font-medium text-zinc-500">ตลาดการ์ดเกมสำหรับนักสะสม</p>
        <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-6xl sm:leading-tight">
          ซื้อ ขาย แลก
          <br />
          <span className="text-zinc-400">การ์ดใบที่ตามหา</span>
        </h1>
        <form onSubmit={onSearch} className="mt-8 flex max-w-xl gap-2">
          <input
            key={query.q ?? ''}
            name="q"
            type="search"
            defaultValue={query.q}
            maxLength={100}
            placeholder="ค้นหาชื่อการ์ด ชุด หรือเลขการ์ด"
            className="input rounded-full px-5"
          />
          <button type="submit" className="btn btn-primary shrink-0 px-6">
            ค้นหา
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <button
            type="button"
            className={`chip ${!query.game ? 'chip-active' : ''}`}
            onClick={() => update({ game: undefined })}
          >
            ทุกเกม
          </button>
          {games?.map((game) => (
            <button
              key={game.id}
              type="button"
              className={`chip ${query.game === game.slug ? 'chip-active' : ''}`}
              onClick={() => update({ game: game.slug })}
            >
              {game.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-full bg-zinc-100 p-1 text-sm">
            {[undefined, ...kinds].map((kind) => (
              <button
                key={kind ?? 'all'}
                type="button"
                onClick={() => update({ itemKind: kind })}
                className={`rounded-full px-3.5 py-1.5 transition ${query.itemKind === kind ? 'bg-white font-medium shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
              >
                {kind ? kindLabel[kind] : 'ทั้งหมด'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              aria-label="ประเภทประกาศ"
              value={query.type ?? ''}
              onChange={(e) => update({ type: (e.target.value || undefined) as ListingType | undefined })}
              className="input w-auto rounded-full py-2"
            >
              <option value="">ขายและแลก</option>
              <option value="SALE">ซื้อได้</option>
              <option value="TRADE">รับแลก</option>
            </select>
            <select
              aria-label="เรียงตาม"
              value={query.sort ?? 'newest'}
              onChange={(e) => update({ sort: e.target.value === 'newest' ? undefined : e.target.value })}
              className="input w-auto rounded-full py-2"
            >
              {sorts.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        {error !== undefined && !data ? (
          <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(error)}</p>
        ) : !data ? (
          <Spinner />
        ) : data.listings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-200 px-6 py-20 text-center">
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
          <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <p className="text-sm text-zinc-500">{data.total.toLocaleString('th-TH')} รายการ</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
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

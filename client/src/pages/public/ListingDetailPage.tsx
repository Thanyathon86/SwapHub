import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { useAuth } from '@shared/auth/useAuth'
import { Avatar } from '@shared/components/Avatar'
import { RatingBadge } from '@shared/reviews/StarRating'
import {
  conditionLabel,
  formatDate,
  formatGrade,
  formatPrice,
  kindLabel,
  typeLabel,
} from '@shared/listings/labels'
import { listingsApi, type Listing } from '@shared/listings/listingsApi'
import { listingBadge } from '../../features/listings/badge'
import { ListingGallery } from '../../features/listings/ListingGallery'
import { OfferForm } from '../../features/offers/OfferForm'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'

const detailsOf = (l: Listing): [string, string | number | null][] => [
  ['เกม', l.game.name],
  ['ประเภทสินค้า', kindLabel[l.itemKind]],
  ['ชุด', l.setName],
  ['เลขการ์ด', l.cardNumber],
  ['ความหายาก', l.rarity],
  ['สภาพ', l.condition && `${l.condition} · ${conditionLabel[l.condition]}`],
  ['บริษัทเกรด', l.gradingCompany?.name ?? null],
  ['เกรด', l.grade && formatGrade(l.grade)],
  ['เลขเซอร์', l.certNumber],
  ['ภาษา', l.language],
  ['จำนวน', l.itemKind === 'GRADED' ? null : l.quantity],
]

// แถบแดงอยู่แถวแรกของ grid ความสูงเลยตามชื่อการ์ดเสมอ ชื่อยาวแค่ไหนตัวหนังสือสีขาวก็ไม่ล้นออกมาบนพื้นขาว
// รูปการ์ดกินสองแถวเพื่อวางทับขอบล่างของแถบ และเลื่อนตามได้ตลอดความยาวของรายละเอียด
const layoutClass =
  'grid grid-cols-[1rem_minmax(0,1fr)_1rem] sm:grid-cols-[1.5rem_minmax(0,1fr)_1.5rem] md:grid-cols-[minmax(1.5rem,1fr)_minmax(0,18rem)_minmax(0,48rem)_minmax(1.5rem,1fr)] lg:grid-cols-[minmax(2rem,1fr)_minmax(0,24rem)_minmax(0,56rem)_minmax(2rem,1fr)]'

export default function ListingDetailPage() {
  const { id = '' } = useParams()
  const { data: listing, error } = useResource(() => listingsApi.get(id), id)
  const { user } = useAuth()
  const location = useLocation()
  const [offering, setOffering] = useState(false)

  if (error !== undefined && !listing) {
    return (
      <div className="px-4 py-20 text-center">
        <p className="font-medium">{errorMessage(error)}</p>
        <Link to="/browse" className="btn btn-secondary mt-6">
          กลับไปเรียกดูการ์ด
        </Link>
      </div>
    )
  }
  if (!listing) return <Spinner />

  const price = formatPrice(listing.price)
  const badge = listingBadge(listing)
  const actionLabel = listing.type === 'TRADE' ? 'ขอแลก' : listing.type === 'BOTH' ? 'ส่งข้อเสนอซื้อหรือแลก' : 'ส่งคำขอซื้อ'
  const tags = [kindLabel[listing.itemKind], typeLabel[listing.type], badge].filter((tag) => tag !== null && tag !== '')

  return (
    <article className={layoutClass}>
      <div aria-hidden="true" className="col-span-full row-start-1 row-end-4 bg-brand-600 md:row-end-3" />

      <div className="relative col-start-2 row-start-1 pt-3 md:col-end-4 lg:pt-4">
        <Link to="/browse" className="inline-block py-1 text-sm font-medium text-white hover:underline focus-visible:outline-white">
          ← การ์ดทั้งหมด
        </Link>
      </div>

      {/* จอเล็กย่อรูปลง ให้ราคากับปุ่มอยู่ในหน้าจอแรกโดยไม่ต้องเลื่อนไกล */}
      <div className="relative col-start-2 row-start-2 mx-auto w-full max-w-60 pt-2 sm:max-w-72 md:sticky md:top-4 md:row-end-4 md:max-w-none md:self-start md:pb-12 lg:top-20 lg:pt-3">
        <ListingGallery listing={listing} />
      </div>

      <header className="relative col-start-2 row-start-3 pt-5 pb-10 text-white md:col-start-3 md:row-start-2 md:min-h-56 md:pt-2 md:pb-14 md:pl-10 lg:min-h-64 lg:pt-3 lg:pl-14">
        <p className="text-sm font-medium sm:text-base">
          {listing.game.name} · {listing.setName}
        </p>
        <h1 className="mt-1.5 text-3xl/tight font-bold sm:text-4xl/tight lg:text-5xl/tight">{listing.title}</h1>
        <ul className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
          {tags.map((tag) => (
            <li key={tag} className="rounded-full border border-white/80 px-3 py-1">
              {tag}
            </li>
          ))}
        </ul>
      </header>

      <div className="relative col-start-2 row-start-4 -mt-5 space-y-6 pb-12 md:col-start-3 md:row-start-3 md:-mt-8 md:space-y-8 md:pb-16 md:pl-10 lg:pl-14">
        <section aria-label="ราคา" className="rounded-2xl bg-white p-5 shadow-lg ring-1 ring-black/5 sm:p-6">
          <div className="text-sm text-zinc-500">{price ? 'ราคา' : 'ประกาศนี้'}</div>
          <div className="mt-1 text-3xl font-bold text-zinc-900 tabular-nums">{price ?? 'รับแลกเท่านั้น'}</div>
          {listing.type === 'BOTH' && <p className="mt-1 text-sm text-zinc-500">หรือเสนอแลกด้วยการ์ดของคุณ</p>}
          {user?.id === listing.seller.id ? (
            <p className="mt-5 text-sm text-zinc-500">นี่คือประกาศของคุณ ดูข้อเสนอที่เข้ามาได้ที่หน้าข้อเสนอ</p>
          ) : offering ? (
            <OfferForm listing={listing} onCancel={() => setOffering(false)} />
          ) : user ? (
            <button type="button" onClick={() => setOffering(true)} className="btn btn-primary mt-5 w-full py-3 text-base">
              {actionLabel}
            </button>
          ) : (
            <Link to="/login" state={{ from: location.pathname }} className="btn btn-primary mt-5 w-full py-3 text-base">
              เข้าสู่ระบบเพื่อ{actionLabel}
            </Link>
          )}
        </section>

        <Link
          to={`/u/${listing.seller.username}`}
          className="flex items-center gap-3 rounded-2xl p-4 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
        >
          <Avatar user={listing.seller} />
          <div className="min-w-0 text-sm">
            <div className="font-medium">
              {listing.seller.displayName} <span className="font-normal text-zinc-500">@{listing.seller.username}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 text-zinc-500">
              {listing.seller.rating && <RatingBadge rating={listing.seller.rating} />}
              <span>ลงประกาศ {formatDate(listing.createdAt)}</span>
            </div>
          </div>
        </Link>

        <dl className="grid grid-cols-1 gap-x-10 text-sm xl:grid-cols-2">
          {detailsOf(listing)
            .filter(([, value]) => value !== null && value !== '')
            .map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-zinc-100 py-3">
                <dt className="shrink-0 text-zinc-500">{label}</dt>
                <dd className="min-w-0 text-right font-medium">{value}</dd>
              </div>
            ))}
        </dl>

        {listing.description && (
          <div>
            <h2 className="text-sm font-semibold text-zinc-800">รายละเอียดจากผู้ขาย</h2>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-zinc-600">{listing.description}</p>
          </div>
        )}
      </div>
    </article>
  )
}

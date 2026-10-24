import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Spinner } from '../../components/Spinner'
import { useAuth } from '../../features/auth/useAuth'
import {
  artPropsOf,
  conditionLabel,
  formatDate,
  formatGrade,
  formatPrice,
  kindLabel,
  typeLabel,
} from '../../features/listings/labels'
import { ListingArt } from '../../features/listings/ListingArt'
import { listingsApi, type Listing } from '../../features/listings/listingsApi'
import { OfferForm } from '../../features/offers/OfferForm'
import { errorMessage } from '../../lib/api'
import { useResource } from '../../lib/useResource'

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

export default function ListingDetailPage() {
  const { id = '' } = useParams()
  const { data: listing, error } = useResource(() => listingsApi.get(id), id)
  const { user } = useAuth()
  const location = useLocation()
  const [offering, setOffering] = useState(false)

  if (error !== undefined && !listing) {
    return (
      <div className="py-20 text-center">
        <p className="font-medium">{errorMessage(error)}</p>
        <Link to="/" className="btn btn-secondary mt-6">
          กลับหน้าแรก
        </Link>
      </div>
    )
  }
  if (!listing) return <Spinner />

  const price = formatPrice(listing.price)
  const actionLabel = listing.type === 'TRADE' ? 'ขอแลก' : listing.type === 'BOTH' ? 'ส่งข้อเสนอซื้อหรือแลก' : 'ส่งคำขอซื้อ'
  return (
    <div className="space-y-6">
      <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← ทั้งหมด
      </Link>
      <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <div className="mx-auto w-full max-w-sm md:sticky md:top-24 md:self-start">
          <ListingArt {...artPropsOf(listing)} size="lg" />
        </div>

        <div className="space-y-8">
          <div>
            <p className="text-sm text-zinc-500">
              {listing.game.name} · {listing.setName}
            </p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">{listing.title}</h1>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
              <span className="rounded-full bg-zinc-100 px-3 py-1">{typeLabel[listing.type]}</span>
              <span className="rounded-full bg-zinc-100 px-3 py-1">{kindLabel[listing.itemKind]}</span>
            </div>
          </div>

          <div className="rounded-3xl bg-zinc-50 p-6">
            <div className="text-sm text-zinc-500">{price ? 'ราคา' : 'ประกาศนี้'}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">{price ?? 'รับแลกเท่านั้น'}</div>
            {listing.type === 'BOTH' && <p className="mt-1 text-sm text-zinc-500">หรือเสนอแลกด้วยการ์ดของคุณ</p>}
            {user?.id === listing.seller.id ? (
              <p className="mt-5 text-sm text-zinc-500">นี่คือประกาศของคุณ ดูข้อเสนอที่เข้ามาได้ที่หน้าข้อเสนอ</p>
            ) : offering ? (
              <OfferForm listing={listing} onCancel={() => setOffering(false)} />
            ) : user ? (
              <button type="button" onClick={() => setOffering(true)} className="btn btn-primary mt-5 w-full py-3">
                {actionLabel}
              </button>
            ) : (
              <Link to="/login" state={{ from: location.pathname }} className="btn btn-primary mt-5 w-full py-3">
                เข้าสู่ระบบเพื่อ{actionLabel}
              </Link>
            )}
          </div>

          <dl className="divide-y divide-zinc-100 text-sm">
            {detailsOf(listing)
              .filter(([, value]) => value !== null && value !== '')
              .map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-3">
                  <dt className="text-zinc-500">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
          </dl>

          {listing.description && (
            <div>
              <h2 className="text-sm font-medium">รายละเอียดจากผู้ขาย</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-zinc-600">{listing.description}</p>
            </div>
          )}

          <div className="flex items-center gap-3 border-t border-zinc-100 pt-6">
            <span className="grid size-10 place-items-center rounded-full bg-zinc-100 font-semibold text-zinc-700 uppercase">
              {listing.seller.displayName.slice(0, 1)}
            </span>
            <div className="text-sm">
              <div className="font-medium">{listing.seller.displayName}</div>
              <div className="text-zinc-500">ลงประกาศ {formatDate(listing.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

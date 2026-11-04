import { useState } from 'react'
import { Link, useLocation, useParams, useNavigate } from 'react-router'
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
import { chatApi } from '../../features/chat/chatApi'
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

export default function ListingDetailPage() {
  const { id = '' } = useParams()
  const { data: listing, error } = useResource(() => listingsApi.get(id), id)
  const { user } = useAuth()
  const location = useLocation()
  const [offering, setOffering] = useState(false)
  const [openingChat, setOpeningChat] = useState(false)
  const [chatError, setChatError] = useState<unknown>(null)
  const navigate = useNavigate()

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

  const openChat = async () => {
    setOpeningChat(true)
    setChatError(null)
    try {
      const { id } = await chatApi.open({ listingId: listing.id })
      navigate(`/messages/${id}`)
    } catch (err) {
      setChatError(err)
      setOpeningChat(false)
    }
  }

  const price = formatPrice(listing.price)
  // สินค้าซีลมีป้ายประเภทบอกอยู่แล้ว ไม่ต้องขึ้น SEALED ซ้ำ
  const badge = listing.itemKind === 'SEALED' ? null : listingBadge(listing)
  const actionLabel = listing.type === 'TRADE' ? 'ขอแลก' : listing.type === 'BOTH' ? 'ส่งข้อเสนอซื้อหรือแลก' : 'ส่งคำขอซื้อ'

  return (
    <article className="page-container pt-3 pb-12 md:pb-16 lg:pt-4">
      <Link to="/browse" className="link-back">
        ← การ์ดทั้งหมด
      </Link>

      {/* รูปเลื่อนไปกับหน้าตามปกติ ถ้าติด sticky รูปจะค้างอยู่ขณะที่ชื่อการ์ดเลื่อนผ่าน แล้วดูเหมือนลอยอยู่เหนือหน้า */}
      <div className="mt-2 grid grid-cols-1 items-start gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-10 lg:mt-3 lg:gap-14">
        <ListingGallery listing={listing} />

        <div className="min-w-0 space-y-5 md:space-y-6">
          <header>
            <p className="text-sm font-semibold text-brand-600 sm:text-base">
              {listing.game.name} · {listing.setName}
            </p>
            <h1 className="mt-1 text-2xl/tight font-bold text-zinc-900 sm:text-3xl/tight lg:text-4xl/tight">{listing.title}</h1>
            <ul className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              <li className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">{kindLabel[listing.itemKind]}</li>
              <li className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-700">{typeLabel[listing.type]}</li>
              {/* สภาพหรือเกรดคือข้อมูลแรกที่นักสะสมมองหา จึงเน้นกว่าป้ายอื่น */}
              {badge && <li className="rounded-full bg-brand-50 px-3 py-1 text-brand-700">{badge}</li>}
            </ul>
          </header>

          <section aria-label="ราคา" className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-6">
            <div className="text-sm text-zinc-500">{price ? 'ราคา' : 'ประกาศนี้'}</div>
            <div className="mt-1 text-3xl font-bold text-zinc-900 tabular-nums">{price ?? 'รับแลกเท่านั้น'}</div>
            {listing.type === 'BOTH' && <p className="mt-1 text-sm text-zinc-500">หรือเสนอแลกด้วยการ์ดของคุณ</p>}
            {user?.id === listing.seller.id ? (
              <p className="mt-5 text-sm text-zinc-500">นี่คือประกาศของคุณ ดูข้อเสนอที่เข้ามาได้ที่หน้าข้อเสนอ</p>
            ) : offering ? (
              <OfferForm listing={listing} onCancel={() => setOffering(false)} />
            ) : user ? (
              <>
                <button type="button" onClick={() => setOffering(true)} className="btn btn-primary mt-5 w-full py-3 text-base">
                  {actionLabel}
                </button>
                <button type="button" disabled={openingChat} onClick={openChat} className="btn btn-secondary mt-2 w-full py-3 text-base">
                  แชทกับผู้ขาย
                </button>
                {chatError !== null && <p className="mt-2 text-sm text-red-600">{errorMessage(chatError)}</p>}
              </>
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
      </div>
    </article>
  )
}

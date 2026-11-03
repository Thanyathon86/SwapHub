import { Link } from 'react-router'
import { formatPrice, statusClass, statusLabel } from '@shared/listings/labels'
import { ListingCover } from '@shared/listings/ListingCover'
import type { Listing, ListingStatus } from '@shared/listings/listingsApi'
import { listingBadge } from './badge'

export function ListingCard({ listing }: { listing: Listing }) {
  const price = formatPrice(listing.price)
  const badge = listingBadge(listing)
  return (
    <Link to={`/listings/${listing.id}`} className="group block rounded-xl">
      <div className="relative overflow-hidden rounded-xl bg-zinc-100">
        <div className="transition duration-300 group-hover:scale-[1.03] motion-reduce:transform-none">
          <ListingCover listing={listing} />
        </div>
        {/* ภาพวาดแทนรูปมีสภาพและเกรดอยู่แล้ว ป้ายนี้จำเป็นเฉพาะตอนเป็นรูปจริง */}
        {listing.images.length > 0 && badge && (
          <span className="absolute bottom-2 left-2 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold text-white tabular-nums">
            {badge}
          </span>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="truncate text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">{listing.game.name}</p>
        <h3 className="mt-0.5 line-clamp-2 text-sm/snug text-zinc-900 transition group-hover:text-brand-600 sm:text-[15px]/snug">
          {listing.title}
        </h3>
        <p className={`mt-1 text-sm font-medium tabular-nums sm:text-[15px] ${price ? 'text-zinc-800' : 'text-brand-600'}`}>
          {price ?? 'แลกเท่านั้น'}
        </p>
        {listing.type === 'BOTH' && <p className="mt-0.5 text-xs text-brand-600">รับแลกด้วย</p>}
      </div>
    </Link>
  )
}

// ขนาดเท่าการ์ดจริง กันหน้ากระโดดตอนข้อมูลมาถึง
export function ListingCardSkeleton() {
  return (
    <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
      <div className="aspect-[63/88] rounded-xl bg-zinc-100" />
      <div className="mt-2.5 space-y-2 px-0.5">
        <div className="h-2.5 w-1/3 rounded bg-zinc-100" />
        <div className="h-3.5 w-5/6 rounded bg-zinc-100" />
        <div className="h-3.5 w-1/2 rounded bg-zinc-100" />
      </div>
    </div>
  )
}

export function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusClass[status]}`}>
      {statusLabel[status]}
    </span>
  )
}

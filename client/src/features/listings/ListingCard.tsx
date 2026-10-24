import { Link } from 'react-router'
import { artPropsOf, formatPrice, statusClass, statusLabel } from '@shared/listings/labels'
import { ListingArt } from '@shared/listings/ListingArt'
import type { Listing, ListingStatus } from '@shared/listings/listingsApi'

export function ListingCard({ listing }: { listing: Listing }) {
  const price = formatPrice(listing.price)
  return (
    <Link to={`/listings/${listing.id}`} className="group block">
      <div className="transition duration-300 group-hover:-translate-y-1 group-hover:drop-shadow-xl">
        <ListingArt {...artPropsOf(listing)} />
      </div>
      <div className="mt-3 space-y-0.5 px-0.5">
        <div className="truncate text-sm font-medium">{listing.title}</div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="font-semibold tabular-nums">{price ?? 'แลกเท่านั้น'}</span>
          {listing.type === 'BOTH' && <span className="text-xs text-zinc-500">รับแลกด้วย</span>}
        </div>
      </div>
    </Link>
  )
}

export function StatusBadge({ status }: { status: ListingStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${statusClass[status]}`}>
      {statusLabel[status]}
    </span>
  )
}

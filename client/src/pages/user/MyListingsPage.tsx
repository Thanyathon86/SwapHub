import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Spinner } from '../../components/Spinner'
import { artPropsOf, formatDate, formatPrice, kindLabel, typeLabel } from '../../features/listings/labels'
import { ListingArt } from '../../features/listings/ListingArt'
import { StatusBadge } from '../../features/listings/ListingCard'
import { listingsApi, type Listing } from '../../features/listings/listingsApi'
import { errorMessage } from '../../lib/api'
import { useResource } from '../../lib/useResource'

export default function MyListingsPage() {
  const location = useLocation()
  const created = (location.state as { created?: boolean } | null)?.created === true
  const { data: listings, error, reload } = useResource(listingsApi.mine)
  const [rowError, setRowError] = useState<{ id: string; error: unknown } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const onClose = async (listing: Listing) => {
    if (!window.confirm(`ปิดประกาศ "${listing.title}"? ปิดแล้วเปิดใหม่ไม่ได้`)) return
    setBusyId(listing.id)
    setRowError(null)
    try {
      await listingsApi.close(listing.id)
      reload()
    } catch (err) {
      setRowError({ id: listing.id, error: err })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">ประกาศของฉัน</h1>
          <p className="mt-2 text-sm text-zinc-500">ประกาศใหม่จะขึ้นในตลาดหลังจากผ่านการตรวจ</p>
        </div>
        <Link to="/sell" className="btn btn-primary">
          ลงประกาศ
        </Link>
      </div>

      {created && (
        <p className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">ส่งประกาศแล้ว รอทีมงานตรวจสักครู่</p>
      )}

      {error !== undefined && !listings ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(error)}</p>
      ) : !listings ? (
        <Spinner />
      ) : listings.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 px-6 py-20 text-center">
          <p className="font-medium">ยังไม่มีประกาศ</p>
          <p className="mt-1 text-sm text-zinc-500">ลงการ์ดใบแรกของคุณได้เลย</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {listings.map((listing) => {
            const closable = listing.status === 'PENDING_REVIEW' || listing.status === 'ACTIVE'
            return (
              <li key={listing.id} className="flex gap-4 py-5 sm:gap-6">
                <div className="w-20 shrink-0 sm:w-24">
                  <ListingArt {...artPropsOf(listing)} />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={listing.status} />
                    <span className="text-xs text-zinc-500">
                      {kindLabel[listing.itemKind]} · {typeLabel[listing.type]} · {formatDate(listing.createdAt)}
                    </span>
                  </div>
                  <div className="truncate font-medium">{listing.title}</div>
                  <div className="text-sm text-zinc-500">
                    {listing.game.name} · {listing.setName}
                  </div>
                  <div className="text-sm font-semibold tabular-nums">{formatPrice(listing.price) ?? 'แลกเท่านั้น'}</div>
                  {listing.status === 'REJECTED' && listing.rejectReason && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">เหตุผล: {listing.rejectReason}</p>
                  )}
                  {rowError?.id === listing.id && <p className="text-sm text-red-600">{errorMessage(rowError.error)}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {listing.status === 'ACTIVE' && (
                    <Link to={`/listings/${listing.id}`} className="btn btn-secondary">
                      ดูประกาศ
                    </Link>
                  )}
                  {closable && (
                    <button
                      type="button"
                      disabled={busyId === listing.id}
                      onClick={() => onClose(listing)}
                      className="btn btn-danger"
                    >
                      ปิดประกาศ
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

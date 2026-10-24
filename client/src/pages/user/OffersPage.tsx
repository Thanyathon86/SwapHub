import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Avatar } from '@shared/components/Avatar'
import { Spinner } from '@shared/components/Spinner'
import { RatingBadge } from '@shared/reviews/StarRating'
import { formatDate, formatPrice } from '@shared/listings/labels'
import { offerStatusClass, offerStatusLabel } from '../../features/offers/labels'
import { offersApi, type Offer } from '../../features/offers/offersApi'
import { ReviewPanel } from '../../features/offers/ReviewPanel'
import { errorMessage } from '@shared/lib/api'
import { useResource } from '@shared/lib/useResource'

type Tab = 'incoming' | 'outgoing'

const tabs: [Tab, string][] = [
  ['incoming', 'เข้ามา'],
  ['outgoing', 'ส่งไป'],
]

export default function OffersPage() {
  // เก็บแท็บใน URL เพื่อให้ลิงก์จากหน้าอื่นเปิดแท็บที่ถูกต้องได้ และกด back แล้วไม่หลุดแท็บ
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'outgoing' ? 'outgoing' : 'incoming'
  const { user } = useAuth()
  const { data: offers, error, reload } = useResource(offersApi[tab], tab)
  const [rowError, setRowError] = useState<{ id: string; error: unknown } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const act = async (offer: Offer, action: 'accept' | 'decline' | 'cancel', confirmText: string) => {
    if (!window.confirm(confirmText)) return
    setBusyId(offer.id)
    setRowError(null)
    try {
      await offersApi[action](offer.id)
      reload()
    } catch (err) {
      setRowError({ id: offer.id, error: err })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">ข้อเสนอ</h1>
        <p className="mt-2 text-sm text-zinc-500">หลังตอบรับแล้ว ทั้งสองฝ่ายจะเห็นอีเมลของกันและกันไว้นัดส่งของ</p>
      </div>

      <div className="flex gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setParams({ tab: key }, { replace: true })}
            className={`chip ${tab === key ? 'chip-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error !== undefined && !offers ? (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(error)}</p>
      ) : !offers ? (
        <Spinner />
      ) : offers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-zinc-200 px-6 py-20 text-center">
          <p className="font-medium">{tab === 'incoming' ? 'ยังไม่มีข้อเสนอเข้ามา' : 'ยังไม่ได้ส่งข้อเสนอ'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {offers.map((offer) => {
            const pending = offer.status === 'PENDING'
            const busy = busyId === offer.id
            const counterpart = tab === 'incoming' ? offer.buyer : offer.listing.seller
            return (
              <li key={offer.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:gap-6">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${offerStatusClass[offer.status]}`}
                    >
                      {offerStatusLabel[offer.status]}
                    </span>
                    <span className="text-xs text-zinc-500">{formatDate(offer.createdAt)}</span>
                  </div>
                  {/* คะแนนของอีกฝ่ายอยู่ตรงนี้ ผู้ขายดูก่อนตัดสินใจตอบรับได้ว่าคนที่ขอมาเชื่อถือได้แค่ไหน */}
                  <Link to={`/u/${counterpart.username}`} className="flex w-fit items-center gap-2 text-sm hover:opacity-80">
                    <Avatar user={counterpart} />
                    <span>
                      <span className="text-zinc-500">{tab === 'incoming' ? 'จาก' : 'ถึง'}</span>{' '}
                      <span className="font-medium">{counterpart.displayName}</span>
                    </span>
                    <RatingBadge rating={counterpart.rating} />
                  </Link>
                  <Link to={`/listings/${offer.listing.id}`} className="block truncate font-medium hover:underline">
                    {offer.listing.title}
                    {offer.quantity > 1 && <span className="text-zinc-500"> × {offer.quantity}</span>}
                  </Link>
                  <div className="space-y-1 text-sm text-zinc-600">
                    {offer.cashAmount !== null && (
                      <div>
                        เงิน <span className="font-semibold tabular-nums">{formatPrice(offer.cashAmount)}</span>
                      </div>
                    )}
                    {offer.items.length > 0 && (
                      <div>
                        แลกด้วย:{' '}
                        {offer.items
                          .map((i) => (i.quantity > 1 ? `${i.listing.title} × ${i.quantity}` : i.listing.title))
                          .join(', ')}
                      </div>
                    )}
                  </div>
                  {offer.message && (
                    <p className="rounded-xl bg-zinc-50 px-3 py-2 text-sm whitespace-pre-line text-zinc-600">
                      {offer.message}
                    </p>
                  )}
                  {counterpart.email && (
                    <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      ติดต่อ {counterpart.displayName}: {counterpart.email}
                    </p>
                  )}
                  {offer.status === 'ACCEPTED' && user && (
                    <ReviewPanel offer={offer} me={user.id} other={counterpart} onSaved={reload} />
                  )}
                  {rowError?.id === offer.id && <p className="text-sm text-red-600">{errorMessage(rowError.error)}</p>}
                </div>
                {pending && (
                  <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
                    {tab === 'incoming' ? (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act(offer, 'accept', 'ตอบรับข้อเสนอนี้? ระบบจะตัดจำนวนการ์ดในประกาศให้อัตโนมัติ')}
                          className="btn btn-primary"
                        >
                          ตอบรับ
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act(offer, 'decline', 'ปฏิเสธข้อเสนอนี้?')}
                          className="btn btn-danger"
                        >
                          ปฏิเสธ
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => act(offer, 'cancel', 'ยกเลิกข้อเสนอนี้?')}
                        className="btn btn-danger"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

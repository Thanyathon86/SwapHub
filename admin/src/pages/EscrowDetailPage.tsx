import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '@shared/auth/useAuth'
import { Spinner } from '@shared/components/Spinner'
import { errorMessage } from '@shared/lib/api'
import { formatPrice } from '@shared/listings/labels'
import { useResource } from '@shared/lib/useResource'
import { MessageThread } from '@shared/support/MessageThread'
import { adminApi, type AdminEscrowDetail, type EscrowParty } from '../features/adminApi'
import { escrowEventLabels, escrowStatusLabels, formatDateTime } from '../features/labels'
import { clientUrl } from '../lib/env'

const HOLDING = new Set(['HELD', 'SHIPPED', 'DISPUTED'])

const when = (iso: string | null) => (iso ? formatDateTime(iso) : '-')

function PartyCard({ title, party, carrier, tracking, shippedAt, receivedAt }: {
  title: string
  party: EscrowParty
  carrier: string | null
  tracking: string | null
  shippedAt: string | null
  receivedAt: string | null
}) {
  return (
    <div className="min-w-0 space-y-1 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
      <h2 className="text-xs font-medium text-slate-500">{title}</h2>
      <a href={`${clientUrl}/u/${party.username}`} target="_blank" rel="noreferrer" className="font-medium text-slate-800 hover:underline">
        {party.displayName}
      </a>
      <p className="text-slate-600">{party.email}</p>
      {party.status === 'SUSPENDED' && <p className="font-medium text-amber-800">บัญชีถูกระงับ</p>}
      <p className="text-slate-600">พัสดุที่ส่ง: {tracking ? `${carrier} ${tracking}` : '-'}</p>
      <p className="text-slate-600">แจ้งส่ง: {when(shippedAt)}</p>
      <p className="text-slate-600">ยืนยันรับ: {when(receivedAt)}</p>
    </div>
  )
}

export default function EscrowDetailPage() {
  const { id = '' } = useParams()
  const { user: me } = useAuth()
  const { data: loaded, error, reload } = useResource(() => adminApi.getEscrow(id), id)
  const [updated, setUpdated] = useState<AdminEscrowDetail | null>(null)
  const escrow = updated?.id === id ? updated : loaded
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)

  if (error !== undefined && !escrow) {
    return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
  }
  if (!escrow) return <Spinner />

  const isParty = me?.id === escrow.buyerId || me?.id === escrow.sellerId
  const canResolve = HOLDING.has(escrow.status) && !isParty

  const onResolve = (decision: 'RELEASE' | 'REFUND') => async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const reason = String(new FormData(form).get('reason')).trim()
    if (!reason) return
    const question =
      decision === 'RELEASE'
        ? `โอน ${formatPrice(escrow.amount)} ให้ ${escrow.seller.displayName}? ย้อนกลับไม่ได้`
        : `คืน ${formatPrice(escrow.amount)} ให้ ${escrow.buyer.displayName}? ย้อนกลับไม่ได้`
    if (!window.confirm(question)) return
    setBusy(true)
    setActionError(null)
    try {
      setUpdated(await adminApi.resolveEscrow(id, decision, reason))
    } catch (err) {
      setActionError(err)
      // admin คนอื่นอาจตัดสินไปก่อน โหลดใหม่ให้ตรงกับความจริง
      reload()
    } finally {
      setBusy(false)
    }
  }

  const nameOf = (authorId: string) =>
    authorId === escrow.buyerId ? `${escrow.buyer.displayName} (ผู้ซื้อ)` : `${escrow.seller.displayName} (ผู้ขาย)`

  return (
    <section className="space-y-6">
      <div>
        <Link to="/escrows" className="text-sm text-slate-500 hover:underline">
          ← เงินวางกลาง
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="min-w-0 text-2xl font-bold text-slate-800">{escrow.offer.listing.title}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${escrowStatusLabels[escrow.status].className}`}>
            {escrowStatusLabels[escrow.status].text}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          ยอด <span className="font-semibold tabular-nums">{formatPrice(escrow.amount)}</span> · จำนวน {escrow.offer.quantity}
          {escrow.offer.items.length > 0 &&
            ` · แลกด้วย ${escrow.offer.items.map((i) => (i.quantity > 1 ? `${i.listing.title} × ${i.quantity}` : i.listing.title)).join(', ')}`}
        </p>
      </div>

      {escrow.disputeReason && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          ข้อพิพาท {when(escrow.disputedAt)} โดย {escrow.disputedBy?.displayName ?? 'ระบบ'}: {escrow.disputeReason}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PartyCard
          title="ผู้ซื้อ"
          party={escrow.buyer}
          carrier={escrow.buyerCarrier}
          tracking={escrow.buyerTrackingNumber}
          shippedAt={escrow.buyerShippedAt}
          receivedAt={escrow.buyerReceivedAt}
        />
        <PartyCard
          title="ผู้ขาย"
          party={escrow.seller}
          carrier={escrow.sellerCarrier}
          tracking={escrow.sellerTrackingNumber}
          shippedAt={escrow.sellerShippedAt}
          receivedAt={escrow.sellerReceivedAt}
        />
      </div>

      {isParty && HOLDING.has(escrow.status) && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">คุณเป็นคู่ดีลนี้ จึงตัดสินเองไม่ได้ ให้ admin คนอื่นดูแล</p>
      )}

      {canResolve && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(['RELEASE', 'REFUND'] as const).map((decision) => (
            <form key={decision} onSubmit={onResolve(decision)} className="space-y-2 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
              <h2 className="font-semibold text-slate-800">
                {decision === 'RELEASE' ? `โอนเงินให้ผู้ขาย (${escrow.seller.displayName})` : `คืนเงินให้ผู้ซื้อ (${escrow.buyer.displayName})`}
              </h2>
              <textarea
                name="reason"
                required
                rows={3}
                maxLength={1000}
                placeholder="เหตุผล คู่ดีลทั้งสองฝ่ายจะเห็นข้อความนี้"
                aria-label={decision === 'RELEASE' ? 'เหตุผลที่โอนเงินให้ผู้ขาย' : 'เหตุผลที่คืนเงินให้ผู้ซื้อ'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
              />
              <button type="submit" disabled={busy} className="rounded-lg bg-brand-600 px-4 py-1.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                {decision === 'RELEASE' ? 'โอนเงิน' : 'คืนเงิน'}
              </button>
            </form>
          ))}
        </div>
      )}
      {actionError !== null && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{errorMessage(actionError)}</p>}

      {escrow.settledAt && (
        <p className="rounded-xl bg-white p-4 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200">
          ปิดเมื่อ {formatDateTime(escrow.settledAt)}
          {escrow.resolvedBy && ` โดย ${escrow.resolvedBy.displayName}`}
          {escrow.resolutionNote && ` · ${escrow.resolutionNote}`}
        </p>
      )}

      <div className="rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-800">กำหนดเวลาและเลขอ้างอิง</h2>
        <dl className="mt-2 grid grid-cols-1 gap-1 text-slate-600 sm:grid-cols-2">
          <div>กำหนดชำระ: {when(escrow.paymentDueAt)}</div>
          <div>ชำระเมื่อ: {when(escrow.paidAt)}</div>
          <div>กำหนดส่ง: {when(escrow.shipDueAt)}</div>
          <div>กำหนดยืนยันรับ: {when(escrow.confirmDueAt)}</div>
          <div className="min-w-0">เลขชำระ: {escrow.paymentRef ?? '-'}</div>
          <div className="min-w-0">เลขโอน/คืน: {escrow.payoutRef ?? escrow.refundRef ?? '-'}</div>
        </dl>
      </div>

      <div className="rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold text-slate-800">ประวัติ</h2>
        <ol className="mt-2 space-y-1.5 text-slate-600">
          {escrow.events.map((ev) => (
            <li key={ev.id}>
              <span className="text-xs text-slate-500">{formatDateTime(ev.createdAt)}</span> {escrowEventLabels[ev.type]} โดย{' '}
              {ev.actor?.displayName ?? 'ระบบ'}
              {ev.note && <span className="text-slate-500"> · {ev.note}</span>}
            </li>
          ))}
        </ol>
      </div>

      {escrow.disputedAt && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">แชทของดีล</h2>
          {escrow.messages.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มีข้อความ</p>
          ) : (
            <MessageThread
              messages={escrow.messages}
              nameOf={(m) => nameOf(m.authorId)}
              mine={(m) => m.authorId === escrow.sellerId}
              imageOf={(m) => m.image && { ...m.image, src: adminApi.escrowImageUrl(escrow.id, m.id) }}
            />
          )}
        </div>
      )}
    </section>
  )
}

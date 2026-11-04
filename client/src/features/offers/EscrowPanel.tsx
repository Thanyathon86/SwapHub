import { useState, type FormEvent } from 'react'
import { errorMessage } from '@shared/lib/api'
import { formatPrice } from '@shared/listings/labels'
import { escrowActorLabel, escrowEventLabel, escrowStatusClass, escrowStatusLabel } from './labels'
import { escrowApi, type Escrow } from './offersApi'

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

type Role = 'BUYER' | 'SELLER'

// ขั้นต่อไปของแต่ละสถานะ บอกให้รู้ว่าตอนนี้รอใคร และถ้าเงียบแล้วจะเกิดอะไรขึ้น
const nextStep = (escrow: Escrow, role: Role) => {
  switch (escrow.status) {
    case 'AWAITING_PAYMENT':
      return role === 'BUYER'
        ? `ชำระเงินภายใน ${formatTime(escrow.paymentDueAt)} ไม่งั้นดีลจะถูกยกเลิก`
        : `รอผู้ซื้อชำระเงินภายใน ${formatTime(escrow.paymentDueAt)} อย่าเพิ่งส่งของจนกว่าเงินจะเข้า`
    case 'HELD':
      return `ระบบถือเงินไว้แล้ว ต้องส่งของภายใน ${escrow.shipDueAt && formatTime(escrow.shipDueAt)} ไม่งั้นระบบจะคืนเงินผู้ซื้อ`
    case 'SHIPPED':
      return `ตรวจของแล้วยืนยันรับ หรือเปิดข้อพิพาทภายใน ${escrow.confirmDueAt && formatTime(escrow.confirmDueAt)} เลยกำหนดแล้วระบบจะโอนเงินให้ผู้ขาย`
    case 'DISPUTED':
      return 'ทีมงานกำลังตรวจสอบ ระบบถือเงินไว้จนกว่าจะมีคำตัดสิน ส่งหลักฐานเพิ่มได้ทางแชทของข้อเสนอนี้'
    case 'RELEASED':
      return 'โอนเงินให้ผู้ขายแล้ว'
    case 'REFUNDED':
      return 'คืนเงินให้ผู้ซื้อแล้ว'
    default:
      return 'ดีลนี้ถูกยกเลิก ไม่มีการตัดเงิน'
  }
}

export function EscrowPanel({ escrow, role, onChanged }: { escrow: Escrow; role: Role; onChanged: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [disputing, setDisputing] = useState(false)

  const run = async (action: () => Promise<unknown>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError(null)
    try {
      await action()
      setDisputing(false)
      onChanged()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  const onShip = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    void run(() =>
      escrowApi.ship(escrow.id, {
        carrier: String(form.get('carrier')).trim(),
        trackingNumber: String(form.get('trackingNumber')).trim(),
      }),
    )
  }

  const onDispute = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const reason = String(new FormData(e.currentTarget).get('reason')).trim()
    if (reason) void run(() => escrowApi.dispute(escrow.id, reason))
  }

  const isBuyer = role === 'BUYER'
  const iShipped = isBuyer ? escrow.buyerShippedAt : escrow.sellerShippedAt
  const iReceived = isBuyer ? escrow.buyerReceivedAt : escrow.sellerReceivedAt
  // ดีลเงินล้วนมีแต่ผู้ขายที่ส่งของ และมีแต่ผู้ซื้อที่ต้องยืนยันรับ
  const mustShip = escrow.status === 'HELD' && !iShipped && (!isBuyer || escrow.twoWay)
  const mustConfirm = escrow.status === 'SHIPPED' && !iReceived && (isBuyer || escrow.twoWay)
  const canDispute = escrow.status === 'HELD' || escrow.status === 'SHIPPED'
  const nobodyShipped = !escrow.sellerShippedAt && !escrow.buyerShippedAt
  const canCancel = escrow.status === 'AWAITING_PAYMENT' || (escrow.status === 'HELD' && !isBuyer && nobodyShipped)
  const theirTracking = isBuyer
    ? escrow.sellerTrackingNumber && `${escrow.sellerCarrier} ${escrow.sellerTrackingNumber}`
    : escrow.buyerTrackingNumber && `${escrow.buyerCarrier} ${escrow.buyerTrackingNumber}`
  const myTracking = isBuyer
    ? escrow.buyerTrackingNumber && `${escrow.buyerCarrier} ${escrow.buyerTrackingNumber}`
    : escrow.sellerTrackingNumber && `${escrow.sellerCarrier} ${escrow.sellerTrackingNumber}`

  return (
    <section aria-label="เงินวางกลาง" className="space-y-3 rounded-xl border border-zinc-200 p-3 text-sm sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">เงินวางกลาง</h2>
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${escrowStatusClass[escrow.status]}`}>
          {escrowStatusLabel[escrow.status]}
        </span>
        <span className="ml-auto font-semibold tabular-nums">{formatPrice(escrow.amount)}</span>
      </div>

      <p className="text-zinc-600">{nextStep(escrow, role)}</p>

      {escrow.twoWay && escrow.status === 'HELD' && (
        <p className="text-zinc-600">ดีลนี้มีการ์ดแลก ทั้งสองฝ่ายต้องแจ้งส่งของและยืนยันรับก่อนระบบจะโอนเงิน</p>
      )}
      {myTracking && <p className="min-w-0 text-zinc-600">พัสดุของคุณ: {myTracking}</p>}
      {theirTracking && <p className="min-w-0 text-zinc-600">พัสดุของอีกฝ่าย: {theirTracking}</p>}
      {escrow.disputeReason && <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">ข้อพิพาท: {escrow.disputeReason}</p>}
      {escrow.resolutionNote && <p className="rounded-lg bg-zinc-50 px-3 py-2 text-zinc-700">หมายเหตุ: {escrow.resolutionNote}</p>}

      {escrow.status === 'AWAITING_PAYMENT' && isBuyer && (
        <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-3 text-amber-900">
          <p>โหมดทดลอง: กดปุ่มนี้เพื่อจำลองการชำระเงิน ไม่มีการตัดเงินจริง</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => escrowApi.pay(escrow.id), `จำลองการชำระเงิน ${formatPrice(escrow.amount)}?`)}
            className="btn btn-primary"
          >
            ชำระเงิน (จำลอง)
          </button>
        </div>
      )}

      {mustShip && (
        <form onSubmit={onShip} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input name="carrier" required maxLength={60} placeholder="ขนส่ง เช่น ไปรษณีย์ไทย" aria-label="ขนส่ง" className="input" />
          <input name="trackingNumber" required maxLength={60} placeholder="เลขพัสดุ" aria-label="เลขพัสดุ" className="input" />
          <button type="submit" disabled={busy} className="btn btn-primary">
            แจ้งส่งของ
          </button>
        </form>
      )}

      {mustConfirm && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(
              () => escrowApi.confirm(escrow.id),
              escrow.twoWay ? 'ยืนยันว่าได้รับของครบแล้ว?' : 'ยืนยันว่าได้รับของครบแล้ว? ระบบจะโอนเงินให้ผู้ขายทันทีและย้อนกลับไม่ได้',
            )
          }
          className="btn btn-primary"
        >
          ยืนยันได้รับของ
        </button>
      )}

      {disputing ? (
        <form onSubmit={onDispute} className="space-y-2">
          <textarea
            name="reason"
            required
            rows={3}
            maxLength={1000}
            placeholder="เล่าปัญหาให้ทีมงานทราบ อีกฝ่ายจะเห็นข้อความนี้ด้วย"
            aria-label="เหตุผลที่เปิดข้อพิพาท"
            className="input"
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary">
              ส่งให้ทีมงานตรวจสอบ
            </button>
            <button type="button" onClick={() => setDisputing(false)} className="btn btn-secondary">
              ยกเลิก
            </button>
          </div>
        </form>
      ) : (
        (canDispute || canCancel) && (
          <div className="flex flex-wrap gap-2">
            {canDispute && (
              <button type="button" disabled={busy} onClick={() => setDisputing(true)} className="btn btn-secondary">
                เปิดข้อพิพาท
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  run(
                    () => escrowApi.cancel(escrow.id),
                    escrow.status === 'HELD' ? 'ยกเลิกดีลและคืนเงินให้ผู้ซื้อ?' : 'ยกเลิกดีลนี้? การ์ดจะกลับไปที่ประกาศ',
                  )
                }
                className="btn btn-danger"
              >
                {escrow.status === 'HELD' ? 'ยกเลิกและคืนเงิน' : 'ยกเลิกดีล'}
              </button>
            )}
          </div>
        )
      )}

      {error !== null && <p className="text-red-600">{errorMessage(error)}</p>}

      <details>
        <summary className="cursor-pointer text-zinc-500">ประวัติ ({escrow.events.length})</summary>
        <ol className="mt-2 space-y-1.5 text-zinc-600">
          {escrow.events.map((ev) => (
            <li key={ev.id}>
              <span className="text-xs text-zinc-500">{formatTime(ev.createdAt)}</span> {escrowEventLabel[ev.type]} โดย{' '}
              {escrowActorLabel[ev.actor]}
              {ev.note && <span className="text-zinc-500"> · {ev.note}</span>}
            </li>
          ))}
        </ol>
      </details>
    </section>
  )
}

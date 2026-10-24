import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Field, FormField } from '../../components/FormField'
import { Spinner } from '../../components/Spinner'
import { errorMessage, fieldErrors } from '../../lib/api'
import { useResource } from '../../lib/useResource'
import { kindLabel } from '../listings/labels'
import { listingsApi, type Listing } from '../listings/listingsApi'
import { offersApi } from './offersApi'

// key = id ประกาศของเราที่เลือกมาแลก, value = จำนวน
type Picked = Record<string, number>

export function OfferForm({ listing, onCancel }: { listing: Listing; onCancel: () => void }) {
  const canTrade = listing.type !== 'SALE'
  const multiQty = listing.itemKind !== 'GRADED' && listing.quantity > 1

  // ประกาศขายตั้งราคาเริ่มต้นเป็นราคาประกาศ ผู้ซื้อแก้เป็นราคาที่อยากต่อรองได้
  const [cash, setCash] = useState(listing.type === 'TRADE' ? '' : (listing.price ?? ''))
  const [quantity, setQuantity] = useState(1)
  const [message, setMessage] = useState('')
  const [picked, setPicked] = useState<Picked>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [sent, setSent] = useState(false)

  const { data: mine } = useResource(async () => (canTrade ? listingsApi.mine() : []), String(canTrade))
  const tradeable = mine?.filter((l) => l.status === 'ACTIVE' && l.id !== listing.id)

  const toggle = (id: string) =>
    setPicked(({ [id]: current, ...rest }) => (current === undefined ? { ...rest, [id]: 1 } : rest))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await offersApi.create({
        listingId: listing.id,
        quantity,
        cashAmount: cash === '' ? undefined : Number(cash),
        message: message || undefined,
        items: Object.entries(picked).map(([listingId, qty]) => ({ listingId, quantity: qty })),
      })
      setSent(true)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="mt-5 space-y-3 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-800">
        <p>ส่งข้อเสนอแล้ว รอผู้ขายตอบกลับ</p>
        <Link to="/offers?tab=outgoing" className="btn btn-secondary">
          ดูข้อเสนอของฉัน
        </Link>
      </div>
    )
  }

  const errors = fieldErrors(error)
  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-5">
      <FormField
        label={listing.type === 'TRADE' ? 'เงินเพิ่ม (ไม่บังคับ)' : canTrade ? 'เสนอราคา (เว้นว่างได้ถ้าแลกอย่างเดียว)' : 'เสนอราคา'}
        name="cashAmount"
        type="number"
        min="0.01"
        step="0.01"
        inputMode="decimal"
        value={cash}
        onChange={(e) => setCash(e.target.value)}
        required={listing.type === 'SALE'}
        hint={multiQty ? 'ยอดรวมทุกใบ ไม่ใช่ราคาต่อใบ' : undefined}
        errors={errors.cashAmount}
      />

      {multiQty && (
        <FormField
          label={`จำนวน (มี ${listing.quantity})`}
          name="quantity"
          type="number"
          min={1}
          max={listing.quantity}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          errors={errors.quantity}
        />
      )}

      {canTrade && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">การ์ดของคุณที่จะเอามาแลก</span>
          {!tradeable ? (
            <Spinner />
          ) : tradeable.length === 0 ? (
            <p className="text-sm text-zinc-500">
              ยังไม่มีประกาศที่เปิดอยู่ให้เอามาแลก{' '}
              <Link to="/sell" className="underline">
                ลงประกาศ
              </Link>
            </p>
          ) : (
            <ul className="max-h-64 divide-y divide-zinc-100 overflow-y-auto rounded-2xl bg-white ring-1 ring-zinc-200">
              {tradeable.map((own) => {
                const qty = picked[own.id]
                return (
                  <li key={own.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={qty !== undefined}
                      onChange={() => toggle(own.id)}
                      aria-label={own.title}
                      className="size-4 accent-zinc-900"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{own.title}</div>
                      <div className="text-xs text-zinc-500">
                        {own.game.name} · {kindLabel[own.itemKind]}
                      </div>
                    </div>
                    {qty !== undefined && own.quantity > 1 && (
                      <input
                        type="number"
                        min={1}
                        max={own.quantity}
                        value={qty}
                        onChange={(e) => setPicked((p) => ({ ...p, [own.id]: Number(e.target.value) }))}
                        aria-label={`จำนวน ${own.title}`}
                        className="input w-20"
                      />
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          {errors.items && <p className="mt-1.5 text-sm text-red-600">ต้องเสนอเงินหรือเลือกการ์ดมาแลกอย่างน้อยหนึ่งอย่าง</p>}
        </div>
      )}

      <Field label="ข้อความถึงผู้ขาย (ไม่บังคับ)" name="message" errors={errors.message}>
        {(aria) => (
          <textarea
            name="message"
            rows={3}
            maxLength={1000}
            className="input"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            {...aria}
          />
        )}
      </Field>

      {error !== null && Object.keys(errors).length === 0 && (
        <p className="text-sm text-red-600">{errorMessage(error)}</p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting} className="btn btn-primary flex-1 py-3">
          ส่งข้อเสนอ
        </button>
        <button type="button" onClick={onCancel} className="btn btn-secondary py-3">
          ยกเลิก
        </button>
      </div>
    </form>
  )
}

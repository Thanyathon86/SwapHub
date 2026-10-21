import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Field, FormField } from '../../components/FormField'
import { Spinner } from '../../components/Spinner'
import { conditionLabel, kindLabel, typeLabel } from '../../features/listings/labels'
import { ListingArt } from '../../features/listings/ListingArt'
import {
  listingsApi,
  type CardCondition,
  type CreateListingInput,
  type ItemKind,
  type ListingType,
} from '../../features/listings/listingsApi'
import { errorMessage, fieldErrors } from '../../lib/api'
import { useResource } from '../../lib/useResource'

const kinds: { value: ItemKind; hint: string }[] = [
  { value: 'SINGLE', hint: 'การ์ดดิบ ระบุสภาพเอง' },
  { value: 'GRADED', hint: 'อยู่ใน slab มีเลขเซอร์' },
  { value: 'SEALED', hint: 'booster, box, deck' },
]
const types: ListingType[] = ['SALE', 'TRADE', 'BOTH']
const conditions: CardCondition[] = ['NM', 'LP', 'MP', 'HP', 'DMG']
const languages = ['TH', 'EN', 'JP', 'KR', 'CN']

type Draft = {
  itemKind: ItemKind
  type: ListingType
  gameId: string
  title: string
  setName: string
  language: string
  cardNumber: string
  rarity: string
  condition: CardCondition
  gradingCompanyId: string
  grade: string
  certNumber: string
  quantity: string
  price: string
  description: string
}

const initialDraft: Draft = {
  itemKind: 'SINGLE',
  type: 'SALE',
  gameId: '',
  title: '',
  setName: '',
  language: 'EN',
  cardNumber: '',
  rarity: '',
  condition: 'NM',
  gradingCompanyId: '',
  grade: '',
  certNumber: '',
  quantity: '1',
  price: '',
  description: '',
}

// ส่งเฉพาะฟิลด์ของ itemKind ที่เลือก server ใช้ strictObject ถ้าส่งฟิลด์เกินมาจะถูกปฏิเสธ
const toInput = (d: Draft): CreateListingInput => {
  const base = {
    gameId: d.gameId,
    type: d.type,
    title: d.title,
    setName: d.setName,
    language: d.language,
    description: d.description,
    ...(d.type !== 'TRADE' && d.price !== '' && { price: Number(d.price) }),
  }
  const card = { cardNumber: d.cardNumber, rarity: d.rarity }
  if (d.itemKind === 'SINGLE') {
    return { ...base, ...card, itemKind: 'SINGLE', condition: d.condition, quantity: Number(d.quantity) }
  }
  if (d.itemKind === 'GRADED') {
    return {
      ...base,
      ...card,
      itemKind: 'GRADED',
      gradingCompanyId: d.gradingCompanyId,
      grade: Number(d.grade),
      certNumber: d.certNumber,
    }
  }
  return { ...base, itemKind: 'SEALED', quantity: Number(d.quantity) }
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  render,
}: {
  value: T
  options: readonly T[]
  onChange: (value: T) => void
  render: (value: T) => ReactNode
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`chip ${value === option ? 'chip-active' : ''}`}
        >
          {render(option)}
        </button>
      ))}
    </div>
  )
}

export default function NewListingPage() {
  const navigate = useNavigate()
  const { data: games, error: gamesError } = useResource(listingsApi.games)
  const { data: companies } = useResource(listingsApi.gradingCompanies)
  const [draft, setDraft] = useState(initialDraft)
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const text = (key: keyof Draft) => ({
    value: draft[key],
    onChange: (e: { target: { value: string } }) => set(key, e.target.value as never),
  })

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await listingsApi.create(toInput(draft))
      navigate('/my-listings', { state: { created: true } })
    } catch (err) {
      setError(err)
      setSubmitting(false)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (gamesError !== undefined && !games) {
    return <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorMessage(gamesError)}</p>
  }
  if (!games) return <Spinner />

  const fields = fieldErrors(error)
  const game = games.find((g) => g.id === draft.gameId)
  const company = companies?.find((c) => c.id === draft.gradingCompanyId)
  const { itemKind } = draft

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">ลงประกาศ</h1>
        <p className="mt-2 text-sm text-zinc-500">ประกาศจะแสดงในตลาดหลังจากทีมงานตรวจแล้ว</p>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <form onSubmit={onSubmit} className="space-y-10" noValidate>
          {error !== null && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>}

          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium text-zinc-700">ขายอะไร</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {kinds.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  aria-pressed={itemKind === k.value}
                  onClick={() => set('itemKind', k.value)}
                  className={`rounded-2xl p-4 text-left ring-1 transition ${itemKind === k.value ? 'bg-zinc-900 text-white ring-zinc-900' : 'bg-white ring-zinc-200 hover:ring-zinc-400'}`}
                >
                  <div className="font-medium">{kindLabel[k.value]}</div>
                  <div className={`mt-1 text-xs ${itemKind === k.value ? 'text-zinc-300' : 'text-zinc-500'}`}>
                    {k.hint}
                  </div>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-3 text-sm font-medium text-zinc-700">ต้องการ</legend>
            <Segmented value={draft.type} options={types} onChange={(v) => set('type', v)} render={(v) => typeLabel[v]} />
          </fieldset>

          <section className="grid gap-5 sm:grid-cols-2">
            <Field label="เกม" name="gameId" errors={fields.gameId} className="sm:col-span-2">
              {(aria) => (
                <select name="gameId" required className="input" {...aria} {...text('gameId')}>
                  <option value="">เลือกเกม</option>
                  {games.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <FormField
              label={itemKind === 'SEALED' ? 'ชื่อสินค้า' : 'ชื่อการ์ด'}
              name="title"
              maxLength={120}
              required
              placeholder={itemKind === 'SEALED' ? 'เช่น Booster Box' : 'เช่น Charizard ex'}
              className="sm:col-span-2"
              errors={fields.title}
              {...text('title')}
            />
            <FormField
              label="ชุด / เซ็ต"
              name="setName"
              maxLength={120}
              required
              errors={fields.setName}
              {...text('setName')}
            />
            <Field label="ภาษา" name="language" errors={fields.language}>
              {(aria) => (
                <select name="language" className="input" {...aria} {...text('language')}>
                  {languages.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              )}
            </Field>
            {itemKind !== 'SEALED' && (
              <>
                <FormField
                  label="เลขการ์ด (ถ้ามี)"
                  name="cardNumber"
                  maxLength={30}
                  placeholder="เช่น 125/197"
                  errors={fields.cardNumber}
                  {...text('cardNumber')}
                />
                <FormField
                  label="ความหายาก (ถ้ามี)"
                  name="rarity"
                  maxLength={40}
                  placeholder="เช่น SAR, Secret Rare"
                  errors={fields.rarity}
                  {...text('rarity')}
                />
              </>
            )}
          </section>

          {itemKind === 'SINGLE' && (
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-zinc-700">สภาพการ์ด</legend>
              <Segmented
                value={draft.condition}
                options={conditions}
                onChange={(v) => set('condition', v)}
                render={(v) => v}
              />
              <p className="mt-2 text-xs text-zinc-500">{conditionLabel[draft.condition]}</p>
            </fieldset>
          )}

          {itemKind === 'GRADED' && (
            <section className="grid gap-5 sm:grid-cols-3">
              <Field label="บริษัทเกรด" name="gradingCompanyId" errors={fields.gradingCompanyId}>
                {(aria) => (
                  <select name="gradingCompanyId" required className="input" {...aria} {...text('gradingCompanyId')}>
                    <option value="">เลือก</option>
                    {companies?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <FormField
                label="เกรด"
                name="grade"
                type="number"
                inputMode="decimal"
                min={1}
                max={10}
                step={0.5}
                required
                placeholder="10"
                errors={fields.grade}
                {...text('grade')}
              />
              <FormField
                label="เลขเซอร์"
                name="certNumber"
                maxLength={30}
                required
                errors={fields.certNumber}
                {...text('certNumber')}
              />
            </section>
          )}

          <section className="grid gap-5 sm:grid-cols-2">
            {draft.type !== 'TRADE' && (
              <FormField
                label="ราคา (บาท)"
                name="price"
                type="number"
                inputMode="decimal"
                min={0}
                step={0.01}
                required
                errors={fields.price}
                {...text('price')}
              />
            )}
            {itemKind !== 'GRADED' && (
              <FormField
                label="จำนวน"
                name="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                max={999}
                required
                errors={fields.quantity}
                {...text('quantity')}
              />
            )}
            <Field
              label="รายละเอียดเพิ่มเติม"
              name="description"
              errors={fields.description}
              hint="ตำหนิ วิธีส่ง หรือการ์ดที่อยากได้ถ้ารับแลก"
              className="sm:col-span-2"
            >
              {(aria) => (
                <textarea name="description" rows={4} maxLength={2000} className="input" {...aria} {...text('description')} />
              )}
            </Field>
          </section>

          <div className="flex gap-3 border-t border-zinc-100 pt-6">
            <button type="submit" disabled={submitting} className="btn btn-primary px-6 py-2.5">
              {submitting ? 'กำลังส่ง...' : 'ส่งให้ตรวจ'}
            </button>
            <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary px-6 py-2.5">
              ยกเลิก
            </button>
          </div>
        </form>

        <aside className="order-first lg:order-last">
          <div className="mx-auto max-w-56 lg:sticky lg:top-24 lg:max-w-none">
            <p className="mb-3 text-xs font-medium tracking-wider text-zinc-400 uppercase">ตัวอย่าง</p>
            <ListingArt
              gameSlug={game?.slug ?? 'preview'}
              gameName={game?.name ?? 'เกม'}
              title={draft.title}
              setName={draft.setName}
              itemKind={itemKind}
              cardNumber={draft.cardNumber}
              condition={draft.condition}
              gradingCompanyName={company?.name}
              grade={draft.grade}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

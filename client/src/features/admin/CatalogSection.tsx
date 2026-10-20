import { useState, type FormEvent } from 'react'
import { Spinner } from '../../components/Spinner'
import { errorMessage, fieldErrors } from '../../lib/api'
import { useResource } from '../../lib/useResource'

type Item = { id: string; name: string; slug?: string; isActive: boolean; _count: { listings: number } }
type Values = { name?: string; slug?: string; isActive?: boolean }

type Props<T extends Item> = {
  title: string
  // เกมมี slug แต่บริษัทเกรดไม่มี ใช้ component เดียวกันโดยเปิดปิดคอลัมน์นี้
  withSlug: boolean
  load: () => Promise<T[]>
  create: (values: { name: string; slug: string }) => Promise<unknown>
  update: (id: string, values: Values) => Promise<unknown>
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'

export function CatalogSection<T extends Item>({ title, withSlug, load, create, update }: Props<T>) {
  const { data: items, error: loadError, reload } = useResource(load)
  const [createError, setCreateError] = useState<unknown>(null)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<{ id: string; name: string; slug: string } | null>(null)
  const [rowError, setRowError] = useState<{ id: string; error: unknown } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    setCreating(true)
    setCreateError(null)
    try {
      await create({ name: String(form.get('name')), slug: String(form.get('slug') ?? '') })
      formEl.reset()
      reload()
    } catch (err) {
      setCreateError(err)
    } finally {
      setCreating(false)
    }
  }

  const runRowUpdate = async (id: string, values: Values) => {
    setBusyId(id)
    setRowError(null)
    try {
      await update(id, values)
      setEditing(null)
      reload()
    } catch (error) {
      setRowError({ id, error })
    } finally {
      setBusyId(null)
    }
  }

  const onToggle = (item: T) => {
    // ปิดแล้วผู้ใช้จะเลือกตอนลงประกาศใหม่ไม่ได้ ถามก่อนถ้ามีประกาศใช้อยู่
    if (item.isActive && item._count.listings > 0) {
      const ok = window.confirm(`"${item.name}" มีประกาศอยู่ ${item._count.listings} รายการ ปิดใช้งานต่อไหม?`)
      if (!ok) return
    }
    void runRowUpdate(item.id, { isActive: !item.isActive })
  }

  const onSaveEdit = () => {
    if (!editing) return
    void runRowUpdate(editing.id, withSlug ? { name: editing.name, slug: editing.slug } : { name: editing.name })
  }

  const createFields = fieldErrors(createError)

  return (
    <section className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <h2 className="border-b border-slate-200 px-6 py-4 font-semibold text-slate-800">{title}</h2>

      <form onSubmit={onCreate} className="flex flex-wrap items-start gap-3 border-b border-slate-200 px-6 py-4" noValidate>
        <div className="min-w-40 flex-1">
          <input name="name" placeholder="ชื่อ" aria-label="ชื่อ" required className={inputClass} />
          {createFields.name && <p className="mt-1 text-xs text-red-600">{createFields.name.join(', ')}</p>}
        </div>
        {withSlug && (
          <div className="min-w-40 flex-1">
            <input name="slug" placeholder="slug เช่น pokemon" aria-label="slug" required className={inputClass} />
            {createFields.slug && <p className="mt-1 text-xs text-red-600">{createFields.slug.join(', ')}</p>}
          </div>
        )}
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {creating ? 'กำลังเพิ่ม...' : 'เพิ่ม'}
        </button>
        {createError !== null && <p className="w-full text-sm text-red-600">{errorMessage(createError)}</p>}
      </form>

      {loadError !== undefined && !items ? (
        <p className="px-6 py-4 text-sm text-red-600">{errorMessage(loadError)}</p>
      ) : !items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="px-6 py-4 text-sm text-slate-500">ยังไม่มีรายการ</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="px-6 py-2 font-medium">ชื่อ</th>
              {withSlug && <th className="px-3 py-2 font-medium">slug</th>}
              <th className="px-3 py-2 font-medium">ประกาศ</th>
              <th className="px-3 py-2 font-medium">สถานะ</th>
              <th className="px-6 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const isEditing = editing?.id === item.id
              const busy = busyId === item.id
              return (
                <tr key={item.id} className={item.isActive ? '' : 'text-slate-400'}>
                  <td className="px-6 py-2">
                    {isEditing ? (
                      <input
                        value={editing.name}
                        onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                        aria-label="ชื่อ"
                        className={inputClass}
                      />
                    ) : (
                      item.name
                    )}
                  </td>
                  {withSlug && (
                    <td className="px-3 py-2 font-mono text-xs">
                      {isEditing ? (
                        <input
                          value={editing.slug}
                          onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                          aria-label="slug"
                          className={inputClass}
                        />
                      ) : (
                        item.slug
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2">{item._count.listings}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        item.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {item.isActive ? 'ใช้งาน' : 'ปิดอยู่'}
                    </span>
                  </td>
                  <td className="space-x-3 whitespace-nowrap px-6 py-2 text-right">
                    {isEditing ? (
                      <>
                        <button type="button" onClick={onSaveEdit} disabled={busy} className="text-indigo-600 hover:underline">
                          บันทึก
                        </button>
                        <button type="button" onClick={() => setEditing(null)} className="text-slate-500 hover:underline">
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setRowError(null)
                            setEditing({ id: item.id, name: item.name, slug: item.slug ?? '' })
                          }}
                          className="text-indigo-600 hover:underline"
                        >
                          แก้ไข
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggle(item)}
                          disabled={busy}
                          className="text-slate-600 hover:underline disabled:opacity-60"
                        >
                          {item.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        </button>
                      </>
                    )}
                    {rowError?.id === item.id && (
                      <p className="mt-1 text-xs whitespace-normal text-red-600">{errorMessage(rowError.error)}</p>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

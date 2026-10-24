import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Field, FormField } from '@shared/components/FormField'
import { errorMessage, fieldErrors } from '@shared/lib/api'
import { ticketCategories, ticketCategoryLabel, type TicketCategory } from '@shared/support/types'
import { supportApi } from '../../features/support/supportApi'

export default function NewTicketPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      const ticket = await supportApi.create({
        subject: String(form.get('subject')),
        category: String(form.get('category')) as TicketCategory,
        body: String(form.get('body')),
      })
      navigate(`/support/${ticket.id}`, { replace: true })
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  const errors = fieldErrors(error)
  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <Link to="/support" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← ติดต่อทีมงาน
        </Link>
        <h1 className="mt-2 text-3xl font-semibold">แจ้งเรื่องใหม่</h1>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {error !== null && Object.keys(errors).length === 0 && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
        )}
        <Field label="เรื่องเกี่ยวกับ" name="category" errors={errors.category}>
          {(aria) => (
            <select name="category" required defaultValue="" className="input" {...aria}>
              <option value="" disabled>
                เลือกหมวด
              </option>
              {ticketCategories.map((c) => (
                <option key={c} value={c}>
                  {ticketCategoryLabel[c]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <FormField label="หัวข้อ" name="subject" required maxLength={120} errors={errors.subject} />
        <Field
          label="รายละเอียด"
          name="body"
          errors={errors.body}
          hint="บอกให้ละเอียดว่าเกิดอะไรขึ้น ถ้าเกี่ยวกับประกาศหรือข้อเสนอ ใส่ชื่อการ์ดมาด้วย"
        >
          {(aria) => <textarea name="body" rows={6} required maxLength={2000} className="input" {...aria} />}
        </Field>
        <button type="submit" disabled={submitting} className="btn btn-primary w-full py-3">
          {submitting ? 'กำลังส่ง...' : 'ส่งเรื่อง'}
        </button>
      </form>
    </div>
  )
}

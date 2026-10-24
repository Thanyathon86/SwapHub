import { useState, type FormEvent } from 'react'
import { FormField } from '../components/FormField'
import { errorMessage, fieldErrors } from '../lib/api'
import { authApi } from './authApi'

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email'))
    setSubmitting(true)
    setError(null)
    try {
      await authApi.forgotPassword(email)
      setSentTo(email)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  // server ตอบเหมือนกันไม่ว่าอีเมลจะมีบัญชีหรือไม่ ข้อความจึงต้องพูดแบบมีเงื่อนไข
  if (sentTo) {
    return (
      <p className="rounded-xl bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-800">
        ถ้า <span className="font-medium">{sentTo}</span> มีบัญชีอยู่ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปแล้ว ลิงก์ใช้ได้ภายใน 30 นาที
        ถ้าไม่เห็นอีเมล ลองดูในโฟลเดอร์สแปม
      </p>
    )
  }

  const fields = fieldErrors(error)
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error !== null && Object.keys(fields).length === 0 && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
      )}
      <p className="text-sm text-zinc-500">กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้</p>
      <FormField label="อีเมล" name="email" type="email" autoComplete="email" required errors={fields.email} />
      <button type="submit" disabled={submitting} className="btn btn-primary w-full py-2.5">
        {submitting ? 'กำลังส่ง...' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
      </button>
    </form>
  )
}

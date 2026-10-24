import { useState, type FormEvent } from 'react'
import { FormField } from '../components/FormField'
import { errorMessage, fieldErrors } from '../lib/api'
import { authApi } from './authApi'
import { useAuth } from './useAuth'

// ตรงกับที่ server บังคับ: ผู้ใช้ทั่วไป 8 ตัว admin 12 ตัว
const minLengthFor = (role: 'USER' | 'ADMIN') => (role === 'ADMIN' ? 12 : 8)

export function ChangePasswordForm() {
  const { user } = useAuth()
  const [error, setError] = useState<unknown>(null)
  const [mismatch, setMismatch] = useState(false)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!user) return null
  const minLength = minLengthFor(user.role)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const newPassword = String(form.get('newPassword'))
    setError(null)
    setDone(false)
    // เช็กช่องยืนยันฝั่ง client อย่างเดียว server ไม่ต้องรู้ค่านี้
    if (newPassword !== String(form.get('confirmPassword'))) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    setSubmitting(true)
    try {
      await authApi.changePassword({ currentPassword: String(form.get('currentPassword')), newPassword })
      formEl.reset()
      setDone(true)
    } catch (err) {
      setError(err)
    } finally {
      setSubmitting(false)
    }
  }

  const fields = fieldErrors(error)
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {done && (
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          เปลี่ยนรหัสผ่านแล้ว อุปกรณ์อื่นที่ล็อกอินไว้ถูกออกจากระบบ
        </p>
      )}
      {error !== null && Object.keys(fields).length === 0 && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
      )}
      <FormField
        label="รหัสผ่านปัจจุบัน"
        name="currentPassword"
        type="password"
        autoComplete="current-password"
        required
        errors={fields.currentPassword}
      />
      <FormField
        label="รหัสผ่านใหม่"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={minLength}
        maxLength={128}
        hint={`อย่างน้อย ${minLength} ตัวอักษร`}
        errors={fields.newPassword}
      />
      <FormField
        label="ยืนยันรหัสผ่านใหม่"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={mismatch ? ['รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน'] : undefined}
      />
      <button type="submit" disabled={submitting} className="btn btn-primary">
        {submitting ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
      </button>
    </form>
  )
}

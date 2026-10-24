import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { FormField } from '../components/FormField'
import { ApiError, errorMessage, fieldErrors } from '../lib/api'
import { authApi } from './authApi'

// ใช้ได้ทั้งเว็บ user และ admin ลิงก์ในอีเมลพามาที่ /reset-password?token=... ของแอปที่ถูกต้องอยู่แล้ว
// ความยาวขั้นต่ำของ admin (12) ให้ server ตรวจ เพราะหน้านี้ยังไม่รู้ว่าเป็นบัญชีแบบไหน
export function ResetPasswordForm() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [error, setError] = useState<unknown>(null)
  const [mismatch, setMismatch] = useState(false)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const invalidLink = (
    <div className="space-y-4 text-sm">
      <p className="rounded-xl bg-red-50 p-4 text-red-700">ลิงก์นี้ใช้ไม่ได้ อาจหมดอายุหรือถูกใช้ไปแล้ว</p>
      <Link to="/forgot-password" className="btn btn-secondary w-full">
        ขอลิงก์ใหม่
      </Link>
    </div>
  )

  if (!token) return invalidLink
  if (error instanceof ApiError && error.code === 'INVALID_RESET_TOKEN') return invalidLink

  if (done) {
    return (
      <div className="space-y-4 text-sm">
        <p className="rounded-xl bg-emerald-50 p-4 text-emerald-800">
          ตั้งรหัสผ่านใหม่แล้ว อุปกรณ์ทุกเครื่องที่เคยล็อกอินไว้ถูกออกจากระบบ
        </p>
        <Link to="/login" className="btn btn-primary w-full">
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    )
  }

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const newPassword = String(form.get('newPassword'))
    setError(null)
    if (newPassword !== String(form.get('confirmPassword'))) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    setSubmitting(true)
    try {
      await authApi.resetPassword({ token, newPassword })
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
      {error !== null && Object.keys(fields).length === 0 && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>
      )}
      <FormField
        label="รหัสผ่านใหม่"
        name="newPassword"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        maxLength={128}
        hint="อย่างน้อย 8 ตัวอักษร (บัญชีผู้ดูแลอย่างน้อย 12)"
        errors={fields.newPassword}
      />
      <FormField
        label="ยืนยันรหัสผ่านใหม่"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        errors={mismatch ? ['รหัสผ่านทั้งสองช่องไม่ตรงกัน'] : undefined}
      />
      <button type="submit" disabled={submitting} className="btn btn-primary w-full py-2.5">
        {submitting ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
      </button>
    </form>
  )
}

import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { FormField } from '../components/FormField'
import { errorMessage, fieldErrors } from '../lib/api'
import { safeRedirect } from './redirect'
import { useAuth } from './useAuth'

// admin = ใช้ในหน้า /admin/login ซึ่ง server รับเฉพาะบัญชี ADMIN
export function LoginForm({ admin = false }: { admin?: boolean }) {
  const { login: userLogin, adminLogin } = useAuth()
  const login = admin ? adminLogin : userLogin
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      await login({ email: String(form.get('email')), password: String(form.get('password')) })
      const from: unknown = (location.state as { from?: unknown } | null)?.from
      navigate(safeRedirect(from), { replace: true })
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  const fields = fieldErrors(error)
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error !== null && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>}
      <FormField label="อีเมล" name="email" type="email" autoComplete="email" required errors={fields.email} />
      <FormField
        label="รหัสผ่าน"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        errors={fields.password}
      />
      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary w-full py-2.5"
      >
        {submitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
      </button>
    </form>
  )
}

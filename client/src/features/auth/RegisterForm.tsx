import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { FormField } from '@shared/components/FormField'
import { errorMessage, fieldErrors } from '@shared/lib/api'
import { useAuth } from '@shared/auth/useAuth'

export function RegisterForm() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setSubmitting(true)
    setError(null)
    try {
      await register({
        email: String(form.get('email')),
        password: String(form.get('password')),
        displayName: String(form.get('displayName')),
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  const fields = fieldErrors(error)
  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error !== null && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{errorMessage(error)}</p>}
      <FormField
        label="ชื่อที่แสดง"
        name="displayName"
        autoComplete="nickname"
        maxLength={50}
        required
        errors={fields.displayName}
      />
      <FormField label="อีเมล" name="email" type="email" autoComplete="email" required errors={fields.email} />
      <FormField
        label="รหัสผ่าน (อย่างน้อย 8 ตัว)"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={128}
        required
        errors={fields.password}
      />
      <button
        type="submit"
        disabled={submitting}
        className="btn btn-primary w-full py-2.5"
      >
        {submitting ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
      </button>
    </form>
  )
}

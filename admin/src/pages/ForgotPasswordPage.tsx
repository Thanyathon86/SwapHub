import { Link } from 'react-router'
import { ForgotPasswordForm } from '@shared/auth/ForgotPasswordForm'
import { AuthShell } from '../components/AuthShell'

export default function ForgotPasswordPage() {
  return (
    <AuthShell subtitle="ลืมรหัสผ่าน">
      <ForgotPasswordForm />
      <Link to="/login" className="mt-4 block text-center text-sm text-zinc-500 hover:text-zinc-900">
        ← กลับไปเข้าสู่ระบบ
      </Link>
    </AuthShell>
  )
}

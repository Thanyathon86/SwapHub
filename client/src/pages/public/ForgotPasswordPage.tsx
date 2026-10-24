import { Link } from 'react-router'
import { ForgotPasswordForm } from '@shared/auth/ForgotPasswordForm'
import { AuthCard } from './AuthCard'

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="ลืมรหัสผ่าน"
      footer={
        <Link to="/login" className="font-medium text-zinc-900 hover:underline">
          ← กลับไปเข้าสู่ระบบ
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}

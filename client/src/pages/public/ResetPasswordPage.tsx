import { ResetPasswordForm } from '@shared/auth/ResetPasswordForm'
import { AuthCard } from './AuthCard'

export default function ResetPasswordPage() {
  return (
    <AuthCard title="ตั้งรหัสผ่านใหม่" footer={null}>
      <ResetPasswordForm />
    </AuthCard>
  )
}

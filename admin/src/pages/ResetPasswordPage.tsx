import { ResetPasswordForm } from '@shared/auth/ResetPasswordForm'
import { AuthShell } from '../components/AuthShell'

export default function ResetPasswordPage() {
  return (
    <AuthShell subtitle="ตั้งรหัสผ่านใหม่">
      <ResetPasswordForm />
    </AuthShell>
  )
}

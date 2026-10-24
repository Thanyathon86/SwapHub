import { Navigate } from 'react-router'
import { LoginForm } from '@shared/auth/LoginForm'
import { useAuth } from '@shared/auth/useAuth'
import { Spinner } from '@shared/components/Spinner'
import { AuthShell } from '../components/AuthShell'

// ไม่มีลิงก์สมัครสมาชิก เพราะบัญชี admin สร้างได้ผ่าน seed หรือให้ admin คนอื่นตั้งสิทธิ์เท่านั้น
export default function LoginPage() {
  const { user, status } = useAuth()
  if (status === 'loading') return <Spinner />
  if (user?.role === 'ADMIN') return <Navigate to="/" replace />

  return (
    <AuthShell subtitle="สำหรับผู้ดูแลระบบเท่านั้น">
      <LoginForm admin />
    </AuthShell>
  )
}

import { Link, Navigate } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { LoginForm } from '@shared/auth/LoginForm'
import { useAuth } from '@shared/auth/useAuth'
import { AuthCard } from './AuthCard'

export default function LoginPage() {
  const { user, status } = useAuth()
  if (status === 'loading') return <Spinner />
  if (user) return <Navigate to="/" replace />

  return (
    <AuthCard
      title="เข้าสู่ระบบ"
      footer={
        <>
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" className="font-medium text-zinc-900 hover:underline">
            สมัครสมาชิก
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  )
}

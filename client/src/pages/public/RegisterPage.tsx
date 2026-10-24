import { Link, Navigate } from 'react-router'
import { Spinner } from '@shared/components/Spinner'
import { RegisterForm } from '../../features/auth/RegisterForm'
import { useAuth } from '@shared/auth/useAuth'
import { AuthCard } from './AuthCard'

export default function RegisterPage() {
  const { user, status } = useAuth()
  if (status === 'loading') return <Spinner />
  if (user) return <Navigate to="/" replace />

  return (
    <AuthCard
      title="สมัครสมาชิก"
      footer={
        <>
          มีบัญชีแล้ว?{' '}
          <Link to="/login" className="font-medium text-zinc-900 hover:underline">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  )
}

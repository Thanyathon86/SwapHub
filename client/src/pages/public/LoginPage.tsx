import { Link, Navigate } from 'react-router'
import { Spinner } from '../../components/Spinner'
import { LoginForm } from '../../features/auth/LoginForm'
import { useAuth } from '../../features/auth/useAuth'
import { AuthCard } from './AuthCard'

export default function LoginPage() {
  const { user, status } = useAuth()
  if (status === 'loading') return <Spinner />
  if (user) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/'} replace />

  return (
    <AuthCard
      title="เข้าสู่ระบบ"
      footer={
        <>
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" className="text-indigo-600 hover:underline">
            สมัครสมาชิก
          </Link>
        </>
      }
    >
      <LoginForm />
    </AuthCard>
  )
}

import { Link, Navigate } from 'react-router'
import { Spinner } from '../../components/Spinner'
import { LoginForm } from '../../features/auth/LoginForm'
import { useAuth } from '../../features/auth/useAuth'

// ไม่มีลิงก์สมัครสมาชิก เพราะบัญชี admin สร้างได้ผ่าน seed เท่านั้น
export default function AdminLoginPage() {
  const { user, status } = useAuth()
  if (status === 'loading') return <Spinner />
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-lg font-bold text-white">SwapHub Admin</div>
          <p className="mt-1 text-sm text-slate-400">สำหรับผู้ดูแลระบบเท่านั้น</p>
        </div>
        <div className="rounded-3xl bg-white p-6 sm:p-8">
          <LoginForm admin />
        </div>
        <p className="mt-6 text-center text-sm">
          <Link to="/" className="text-slate-400 hover:text-white">
            ← กลับหน้าเว็บ
          </Link>
        </p>
      </div>
    </div>
  )
}

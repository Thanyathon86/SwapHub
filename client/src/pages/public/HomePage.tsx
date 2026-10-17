import { useAuth } from '../../features/auth/useAuth'

export default function HomePage() {
  const { user } = useAuth()
  return (
    <section className="space-y-2">
      <h1 className="text-3xl font-bold text-slate-800">ซื้อ ขาย แลกเปลี่ยน</h1>
      <p className="text-slate-600">
        {user ? `ยินดีต้อนรับ ${user.displayName}` : 'เข้าสู่ระบบเพื่อเริ่มลงประกาศหรือส่งคำขอแลกของ'}
      </p>
    </section>
  )
}

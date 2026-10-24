import { ChangePasswordForm } from '@shared/auth/ChangePasswordForm'
import { useAuth } from '@shared/auth/useAuth'

export default function AccountPage() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <section className="max-w-lg space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">บัญชีของฉัน</h1>

      <dl className="divide-y divide-slate-100 rounded-xl bg-white text-sm shadow-sm ring-1 ring-slate-200">
        <div className="flex justify-between gap-4 px-5 py-3">
          <dt className="text-slate-500">ชื่อที่แสดง</dt>
          <dd className="font-medium text-slate-800">{user.displayName}</dd>
        </div>
        <div className="flex justify-between gap-4 px-5 py-3">
          <dt className="text-slate-500">อีเมล</dt>
          <dd className="truncate font-medium text-slate-800">{user.email}</dd>
        </div>
      </dl>

      <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-4 font-medium text-slate-700">เปลี่ยนรหัสผ่าน</h2>
        <ChangePasswordForm />
      </div>
    </section>
  )
}

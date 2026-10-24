import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ChangePasswordForm } from '@shared/auth/ChangePasswordForm'
import { useAuth } from '@shared/auth/useAuth'
import { errorMessage } from '@shared/lib/api'

// ข้อมูลส่วนตัวอย่างอีเมลแยกมาไว้หน้านี้ ไม่ให้โผล่ในหน้าโปรไฟล์ที่เปิดบ่อยหรือเผลอแคปหน้าจอให้คนอื่นเห็น
export default function SettingsPage() {
  const { user, logoutAll } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<unknown>(null)

  if (!user) return null

  const onLogoutAll = async () => {
    if (!window.confirm('ออกจากระบบทุกอุปกรณ์ รวมถึงเครื่องนี้?')) return
    try {
      await logoutAll()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err)
    }
  }

  return (
    <section className="mx-auto max-w-lg space-y-8">
      <div>
        <Link to="/profile" className="text-sm text-zinc-500 hover:text-zinc-900">
          ← โปรไฟล์
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">ตั้งค่าบัญชี</h1>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500">ข้อมูลบัญชี</h2>
        <dl className="divide-y divide-zinc-100 rounded-3xl text-sm ring-1 ring-zinc-200">
          <div className="flex justify-between gap-4 px-5 py-4">
            <dt className="text-zinc-500">ชื่อที่แสดง</dt>
            <dd className="font-medium">{user.displayName}</dd>
          </div>
          <div className="flex justify-between gap-4 px-5 py-4">
            <dt className="text-zinc-500">อีเมล</dt>
            <dd className="truncate font-medium">{user.email}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500">เปลี่ยนรหัสผ่าน</h2>
        <div className="rounded-3xl px-5 py-5 ring-1 ring-zinc-200">
          <ChangePasswordForm />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-500">ความปลอดภัย</h2>
        <div className="flex items-center justify-between gap-4 rounded-3xl px-5 py-4 ring-1 ring-zinc-200">
          <p className="text-sm text-zinc-600">ใช้เมื่อสงสัยว่ามีคนอื่นเข้าบัญชีจากเครื่องอื่น</p>
          <button type="button" onClick={onLogoutAll} className="btn btn-danger shrink-0">
            ออกจากระบบทุกอุปกรณ์
          </button>
        </div>
        {error !== null && <p className="text-sm text-red-600">{errorMessage(error)}</p>}
      </div>
    </section>
  )
}

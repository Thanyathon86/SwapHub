import type { ReactNode } from 'react'
import { clientUrl } from '../lib/env'

// กรอบของหน้าที่ใช้ตอนยังไม่ล็อกอิน (login, ลืมรหัสผ่าน) ให้หน้าตาเหมือนกัน
export function AuthShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-lg font-bold text-white">SwapHub Admin</div>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-sm">
          <a href={clientUrl} className="text-slate-400 hover:text-white">
            ← ไปหน้าเว็บ
          </a>
        </p>
      </div>
    </div>
  )
}

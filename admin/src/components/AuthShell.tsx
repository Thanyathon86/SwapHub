import type { ReactNode } from 'react'
import { LogoFull } from '@shared/brand/Logo'
import { clientUrl } from '../lib/env'

// กรอบของหน้าที่ใช้ตอนยังไม่ล็อกอิน (login, ลืมรหัสผ่าน) ให้หน้าตาเหมือนกัน
export function AuthShell({ subtitle, children }: { subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LogoFull className="mx-auto mb-3 size-24" />
          <div className="text-lg font-bold text-slate-900">TCGNexus Admin</div>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">{children}</div>
        <p className="mt-6 text-center text-sm">
          <a href={clientUrl} className="text-slate-500 hover:text-slate-900">
            ← ไปหน้าเว็บ
          </a>
        </p>
      </div>
    </div>
  )
}

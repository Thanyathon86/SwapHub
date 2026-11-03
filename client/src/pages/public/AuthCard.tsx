import type { ReactNode } from 'react'
import { LogoFull } from '@shared/brand/Logo'

export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm sm:py-8">
      <LogoFull alt="TCGNexus" className="mx-auto mb-3 size-24 sm:size-28" />
      <h1 className="page-title mb-6 text-center sm:mb-8">{title}</h1>
      <div className="rounded-2xl bg-white p-5 ring-1 ring-zinc-200 sm:p-8">{children}</div>
      <p className="mt-6 text-center text-sm text-zinc-500">{footer}</p>
    </div>
  )
}

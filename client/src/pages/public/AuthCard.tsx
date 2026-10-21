import type { ReactNode } from 'react'

export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="rounded-3xl bg-white p-6 ring-1 ring-zinc-200 sm:p-8">{children}</div>
      <p className="mt-6 text-center text-sm text-zinc-500">{footer}</p>
    </div>
  )
}

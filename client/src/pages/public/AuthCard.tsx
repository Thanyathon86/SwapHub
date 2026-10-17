import type { ReactNode } from 'react'

export function AuthCard({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <div className="mx-auto max-w-sm rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">{title}</h1>
      {children}
      <p className="mt-6 text-center text-sm text-slate-600">{footer}</p>
    </div>
  )
}

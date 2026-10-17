import type { InputHTMLAttributes } from 'react'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  name: string
  errors?: string[] | undefined
}

export function FormField({ label, name, errors, ...inputProps }: Props) {
  const errorId = `${name}-error`
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? errorId : undefined}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 aria-invalid:border-red-500"
        {...inputProps}
      />
      {errors && (
        <span id={errorId} className="mt-1 block text-sm text-red-600">
          {errors.join(', ')}
        </span>
      )}
    </label>
  )
}

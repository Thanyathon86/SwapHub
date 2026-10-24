import type { InputHTMLAttributes, ReactNode } from 'react'

type FieldProps = {
  label: string
  name: string
  errors?: string[] | undefined
  hint?: string
  className?: string
  children: (aria: { 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode
}

// กรอบของช่องกรอกทุกแบบ (input, select, textarea) ให้ label และ error แสดงเหมือนกัน
export function Field({ label, name, errors, hint, className, children }: FieldProps) {
  const errorId = `${name}-error`
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1.5 block text-sm font-medium text-zinc-700">{label}</span>
      {children(errors ? { 'aria-invalid': true, 'aria-describedby': errorId } : {})}
      {errors ? (
        <span id={errorId} className="mt-1.5 block text-sm text-red-600">
          {errors.join(', ')}
        </span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-zinc-500">{hint}</span>
      )}
    </label>
  )
}

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  name: string
  errors?: string[] | undefined
  hint?: string
}

export function FormField({ label, name, errors, hint, className, ...inputProps }: Props) {
  return (
    <Field label={label} name={name} errors={errors} hint={hint} className={className}>
      {(aria) => <input name={name} className="input" {...aria} {...inputProps} />}
    </Field>
  )
}

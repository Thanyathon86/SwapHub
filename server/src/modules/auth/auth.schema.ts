import { z } from 'zod'

const email = z.string().trim().toLowerCase().max(254).pipe(z.email())

export const registerSchema = z.strictObject({
  email,
  // จำกัดความยาวสูงสุดกันการส่งรหัสยาวมาก ๆ ให้ argon2 ทำงานหนัก
  password: z.string().min(8).max(128),
  displayName: z.string().trim().min(1).max(50),
})

export const loginSchema = z.strictObject({
  email,
  password: z.string().min(1).max(128),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>

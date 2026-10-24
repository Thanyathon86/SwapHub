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

// ขั้นต่ำ 8 ตามตอนสมัคร ส่วน admin ต้อง 12 ซึ่งเช็กใน service เพราะต้องรู้ role ก่อน
export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
})

export const forgotPasswordSchema = z.strictObject({ email })

// token เป็น base64url 43 ตัว จำกัดความยาวไว้กันส่งของแปลก ๆ มา
export const resetPasswordSchema = z.strictObject({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(8).max(128),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

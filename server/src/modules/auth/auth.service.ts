import { randomBytes } from 'node:crypto'
import { env } from '../../config/env.js'
import { Prisma, type User } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/password.js'
import { sendMail } from '../../lib/mailer.js'
import { prisma } from '../../lib/prisma.js'
import { hashToken } from '../../lib/session.js'
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from './auth.schema.js'

// เลือกเฉพาะฟิลด์ที่ส่งให้ client ได้ ห้ามส่ง passwordHash ออกไป
export const toPublicUser = (user: Pick<User, 'id' | 'email' | 'displayName' | 'role'>) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  role: user.role,
})

export const register = async (input: RegisterInput) => {
  const passwordHash = await hashPassword(input.password)
  try {
    // role ใช้ค่า default (USER) เสมอ admin สร้างได้ผ่าน seed เท่านั้น
    return await prisma.user.create({
      data: { email: input.email, passwordHash, displayName: input.displayName },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'EMAIL_TAKEN', 'Email is already registered')
    }
    throw err
  }
}

const invalidCredentials = () => new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password')

// แต่ละหน้า login รับเฉพาะ role ของตัวเอง
export type LoginPortal = 'USER' | 'ADMIN'

export const login = async (input: LoginInput, portal: LoginPortal = 'USER') => {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) {
    await burnPasswordCheck(input.password)
    throw invalidCredentials()
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) throw invalidCredentials()

  // บอกว่าโดนระงับได้เพราะผ่านรหัสผ่านแล้ว จึงไม่ได้เปิดช่องให้เดาอีเมล
  if (user.status !== 'ACTIVE') throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Account is suspended')

  // หน้า admin ตอบเหมือนรหัสผิด ไม่ยืนยันกับคนที่ลองเข้าว่าบัญชีนี้มีอยู่จริง
  if (portal === 'ADMIN' && user.role !== 'ADMIN') throw invalidCredentials()
  if (portal === 'USER' && user.role === 'ADMIN') {
    throw new AppError(403, 'USE_ADMIN_LOGIN', 'Admin accounts must sign in from the admin login page')
  }

  return prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
}

// ตรงกับที่ seed บังคับตอนสร้าง admin
const ADMIN_MIN_PASSWORD = 12

const assertPasswordLength = (role: User['role'], password: string) => {
  if (role === 'ADMIN' && password.length < ADMIN_MIN_PASSWORD) {
    throw new AppError(400, 'PASSWORD_TOO_SHORT', `Admin passwords must be at least ${ADMIN_MIN_PASSWORD} characters`)
  }
}

export const changePassword = async (userId: string, keepSessionId: string, input: ChangePasswordInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, role: true } })
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

  // ใช้ 400 ไม่ใช่ 401 เพราะ client ถือว่า 401 คือ session หลุดแล้วจะเด้งออกจากระบบ
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect')
  }
  assertPasswordLength(user.role, input.newPassword)
  if (input.newPassword === input.currentPassword) {
    throw new AppError(400, 'PASSWORD_UNCHANGED', 'New password must be different from the current one')
  }

  const passwordHash = await hashPassword(input.newPassword)
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // เตะอุปกรณ์อื่นออก เผื่อเปลี่ยนรหัสเพราะสงสัยว่ามีคนอื่นเข้าบัญชี แต่เครื่องที่กำลังใช้ยังอยู่ต่อได้
    prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } }),
  ])
}

const RESET_TTL_MS = 30 * 60 * 1000

// คืน userId ถ้ามีการส่งลิงก์จริง ไว้ให้ route บันทึก log แต่ response ต้องเหมือนกันเสมอ (ไม่บอกว่าอีเมลนี้มีบัญชีไหม)
export const requestPasswordReset = async ({ email }: ForgotPasswordInput) => {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, status: true } })
  if (!user || user.status !== 'ACTIVE') return null

  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    // ขอใหม่แล้วลิงก์เก่าใช้ไม่ได้ ลิงก์ที่ใช้ได้มีแค่ฉบับล่าสุด
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
    }),
  ])

  // admin ล็อกอินที่แอปหลังบ้าน ลิงก์ต้องพาไปหน้ารีเซ็ตของแอปนั้น
  const origin = user.role === 'ADMIN' ? env.ADMIN_ORIGIN : env.CLIENT_ORIGIN
  const link = `${new URL(origin).origin}/reset-password?token=${token}`
  // ไม่รอส่งเสร็จ ให้เวลาตอบใกล้เคียงกับกรณีที่ไม่มีบัญชี เดาจากเวลาไม่ได้ว่าอีเมลนี้มีอยู่
  sendMail({
    to: user.email,
    subject: 'ตั้งรหัสผ่านใหม่ SwapHub',
    text: [
      'มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้',
      '',
      'กดลิงก์นี้ภายใน 30 นาทีเพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ครั้งเดียว):',
      link,
      '',
      'ถ้าคุณไม่ได้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ',
    ].join('\n'),
  }).catch((err: unknown) => console.error('Failed to send password reset email:', err))
  return user.id
}

const invalidResetToken = () => new AppError(400, 'INVALID_RESET_TOKEN', 'Reset link is invalid or has expired')

export const resetPassword = async ({ token, newPassword }: ResetPasswordInput) => {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, usedAt: true, expiresAt: true, user: { select: { id: true, role: true, status: true } } },
  })
  // ทุกกรณีที่ใช้ไม่ได้ตอบเหมือนกัน ไม่บอกว่าเป็นเพราะหมดอายุ ใช้ไปแล้ว หรือไม่มีอยู่
  if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.status !== 'ACTIVE') {
    throw invalidResetToken()
  }
  assertPasswordLength(record.user.role, newPassword)

  const passwordHash = await hashPassword(newPassword)
  const userId = record.user.id
  await prisma.$transaction(async (tx) => {
    // usedAt ใน where กันกดลิงก์เดียวกันสองครั้งพร้อมกัน
    const { count } = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (count === 0) throw invalidResetToken()
    await tx.user.update({ where: { id: userId }, data: { passwordHash } })
    // รีเซ็ตมักเกิดตอนสงสัยว่าบัญชีหลุด เตะทุกอุปกรณ์ออก
    await tx.session.deleteMany({ where: { userId } })
  })
  return userId
}

// token ที่หมดอายุหรือใช้แล้วไม่มีประโยชน์ เก็บไว้แค่วันเดียวเผื่อดูย้อนหลัง
export const deleteStaleResetTokens = () =>
  prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })

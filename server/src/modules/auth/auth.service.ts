import { randomBytes } from 'node:crypto'
import { env } from '../../config/env.js'
import { Prisma, type User } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { sendMail } from '../../lib/mailer.js'
import { assertDisplayName } from '../../lib/names.js'
import { burnPasswordCheck, hashPassword, isGuessablePassword, verifyPassword } from '../../lib/password.js'
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
export const toPublicUser = (user: Pick<User, 'id' | 'email' | 'displayName' | 'username' | 'avatarKey' | 'role'>) => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  username: user.username,
  avatarKey: user.avatarKey,
  role: user.role,
})

// ตรงกับที่ seed บังคับตอนสร้าง admin
const ADMIN_MIN_PASSWORD = 12

const assertPasswordPolicy = (user: Pick<User, 'role' | 'email'>, password: string) => {
  if (user.role === 'ADMIN' && password.length < ADMIN_MIN_PASSWORD) {
    throw new AppError(400, 'PASSWORD_TOO_SHORT', `Admin passwords must be at least ${ADMIN_MIN_PASSWORD} characters`)
  }
  if (isGuessablePassword(password, user.email)) {
    throw new AppError(400, 'PASSWORD_TOO_COMMON', 'Password is too easy to guess')
  }
}

// admin ล็อกอินที่แอปหลังบ้าน ลิงก์ในอีเมลต้องพาไปแอปนั้น
const webOrigin = (role: User['role']) => new URL(role === 'ADMIN' ? env.ADMIN_ORIGIN : env.CLIENT_ORIGIN).origin

// ถ้าเจ้าของไม่ได้เปลี่ยนเอง จะได้รู้ตัวและตั้งรหัสใหม่ได้ทัน ไม่รอส่งเสร็จเพราะอีเมลมีปัญหาไม่ควรทำให้การเปลี่ยนรหัสล้ม
const notifyPasswordChanged = (user: Pick<User, 'role' | 'email'>) => {
  sendMail({
    to: user.email,
    subject: 'รหัสผ่าน TCGNexus ของคุณถูกเปลี่ยน',
    text: [
      'รหัสผ่านของบัญชีนี้เพิ่งถูกเปลี่ยน',
      '',
      'ถ้าคุณเป็นคนเปลี่ยนเอง ไม่ต้องทำอะไร',
      `ถ้าไม่ใช่ ให้ตั้งรหัสใหม่ทันทีที่ ${webOrigin(user.role)}/forgot-password`,
    ].join('\n'),
  }).catch((err: unknown) => console.error('Failed to send password changed email:', err))
}

export const register = async (input: RegisterInput) => {
  assertDisplayName(input.displayName)
  assertPasswordPolicy({ role: 'USER', email: input.email }, input.password)
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
  // user ที่ถูกตั้งเป็น admin อาจมีรหัสสั้นกว่าที่กำหนด และรู้ความยาวได้แค่ตอนล็อกอินเพราะเก็บแค่ hash
  // ให้ตั้งใหม่ผ่านลืมรหัสผ่าน ซึ่งบังคับความยาวของ admin อยู่แล้ว
  if (portal === 'ADMIN' && input.password.length < ADMIN_MIN_PASSWORD) {
    throw new AppError(403, 'ADMIN_PASSWORD_TOO_SHORT', 'Reset your password to meet the admin password policy')
  }

  return prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
}

export const changePassword = async (userId: string, keepSessionId: string, input: ChangePasswordInput) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, role: true, email: true },
  })
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

  // ใช้ 400 ไม่ใช่ 401 เพราะ client ถือว่า 401 คือ session หลุดแล้วจะเด้งออกจากระบบ
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect')
  }
  assertPasswordPolicy(user, input.newPassword)
  if (input.newPassword === input.currentPassword) {
    throw new AppError(400, 'PASSWORD_UNCHANGED', 'New password must be different from the current one')
  }

  const passwordHash = await hashPassword(input.newPassword)
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    // เตะอุปกรณ์อื่นออก เผื่อเปลี่ยนรหัสเพราะสงสัยว่ามีคนอื่นเข้าบัญชี แต่เครื่องที่กำลังใช้ยังอยู่ต่อได้
    prisma.session.deleteMany({ where: { userId, id: { not: keepSessionId } } }),
  ])
  notifyPasswordChanged(user)
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

  const link = `${webOrigin(user.role)}/reset-password?token=${token}`
  // ไม่รอส่งเสร็จ ให้เวลาตอบใกล้เคียงกับกรณีที่ไม่มีบัญชี เดาจากเวลาไม่ได้ว่าอีเมลนี้มีอยู่
  sendMail({
    to: user.email,
    subject: 'ตั้งรหัสผ่านใหม่ TCGNexus',
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
    select: {
      id: true,
      usedAt: true,
      expiresAt: true,
      user: { select: { id: true, role: true, status: true, email: true } },
    },
  })
  // ทุกกรณีที่ใช้ไม่ได้ตอบเหมือนกัน ไม่บอกว่าเป็นเพราะหมดอายุ ใช้ไปแล้ว หรือไม่มีอยู่
  if (!record || record.usedAt || record.expiresAt <= new Date() || record.user.status !== 'ACTIVE') {
    throw invalidResetToken()
  }
  assertPasswordPolicy(record.user, newPassword)

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
  notifyPasswordChanged(record.user)
  return userId
}

// token ที่หมดอายุหรือใช้แล้วไม่มีประโยชน์ เก็บไว้แค่วันเดียวเผื่อดูย้อนหลัง
export const deleteStaleResetTokens = () =>
  prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })

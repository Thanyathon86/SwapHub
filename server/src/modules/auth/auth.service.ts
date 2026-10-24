import { Prisma, type User } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { burnPasswordCheck, hashPassword, verifyPassword } from '../../lib/password.js'
import { prisma } from '../../lib/prisma.js'
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.schema.js'

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

export const changePassword = async (userId: string, keepSessionId: string, input: ChangePasswordInput) => {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true, role: true } })
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')

  // ใช้ 400 ไม่ใช่ 401 เพราะ client ถือว่า 401 คือ session หลุดแล้วจะเด้งออกจากระบบ
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect')
  }
  if (user.role === 'ADMIN' && input.newPassword.length < ADMIN_MIN_PASSWORD) {
    throw new AppError(400, 'PASSWORD_TOO_SHORT', `Admin passwords must be at least ${ADMIN_MIN_PASSWORD} characters`)
  }
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

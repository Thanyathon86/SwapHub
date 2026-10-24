import { beforeEach, describe, expect, it } from 'vitest'
import { env } from '../src/config/env.js'
import { devOutbox } from '../src/lib/mailer.js'
import { prisma } from '../src/lib/prisma.js'
import { adminAgent, createUser, eventsOf, loginAdmin, loginUser, PASSWORD, userAgent } from './helpers.js'

beforeEach(() => {
  devOutbox.length = 0
})

const forgot = (email: string) => userAgent().post('/api/auth/forgot-password').send({ email })
const reset = (token: string, newPassword: string) =>
  userAgent().post('/api/auth/reset-password').send({ token, newPassword })

// ดึง token จากลิงก์ในอีเมลฉบับล่าสุด เหมือนผู้ใช้กดลิงก์
const lastLink = () => {
  const mail = devOutbox.at(-1)
  const link = mail?.text.match(/https?:\/\/\S+/)?.[0]
  if (!link) throw new Error('no reset link was sent')
  return new URL(link)
}
const lastToken = () => lastLink().searchParams.get('token') ?? ''

describe('ขอลิงก์ลืมรหัสผ่าน', () => {
  it('อีเมลที่ไม่มีบัญชี ตอบ 204 เหมือนกัน แต่ไม่ส่งอะไร', async () => {
    const res = await forgot('nobody@test.local')
    expect(res.status).toBe(204)
    expect(devOutbox).toHaveLength(0)
    expect((await eventsOf('PASSWORD_RESET_REQUESTED'))[0]).toMatchObject({ userId: null, email: 'nobody@test.local' })
  })

  it('บัญชี user ได้ลิงก์ไปเว็บ user, admin ได้ลิงก์ไปเว็บหลังบ้าน', async () => {
    const user = await createUser()
    const admin = await createUser({ role: 'ADMIN' })
    await forgot(user.email)
    expect(lastLink().origin).toBe(new URL(env.CLIENT_ORIGIN).origin)
    expect(devOutbox.at(-1)?.to).toBe(user.email)
    await forgot(admin.email)
    expect(lastLink().origin).toBe(new URL(env.ADMIN_ORIGIN).origin)
  })

  it('บัญชีที่ถูกระงับไม่ได้ลิงก์', async () => {
    const user = await createUser({ status: 'SUSPENDED' })
    expect((await forgot(user.email)).status).toBe(204)
    expect(devOutbox).toHaveLength(0)
  })

  it('เก็บแค่ hash ของ token ใน DB', async () => {
    const user = await createUser()
    await forgot(user.email)
    const [row] = await prisma.passwordResetToken.findMany()
    expect(row?.tokenHash).not.toBe(lastToken())
    expect(row?.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('ตั้งรหัสใหม่จากลิงก์', () => {
  it('ใช้ได้: รหัสใหม่ล็อกอินได้, รหัสเก่าไม่ได้, ทุกอุปกรณ์หลุด, บันทึก PASSWORD_RESET', async () => {
    const user = await createUser()
    const session = await loginUser(user.email)
    await forgot(user.email)
    expect((await reset(lastToken(), 'Brand-new-pass-1')).status).toBe(204)
    expect((await session.get('/api/auth/me')).status).toBe(401)
    expect((await userAgent().post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(401)
    await loginUser(user.email, 'Brand-new-pass-1')
    expect((await eventsOf('PASSWORD_RESET'))[0]?.userId).toBe(user.id)
  })

  it('ใช้ลิงก์เดิมซ้ำไม่ได้', async () => {
    const user = await createUser()
    await forgot(user.email)
    const token = lastToken()
    await reset(token, 'Brand-new-pass-1')
    expect((await reset(token, 'Another-pass-2')).body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('ขอลิงก์ใหม่แล้วลิงก์เก่าใช้ไม่ได้', async () => {
    const user = await createUser()
    await forgot(user.email)
    const oldToken = lastToken()
    await forgot(user.email)
    expect((await reset(oldToken, 'Brand-new-pass-1')).body.error.code).toBe('INVALID_RESET_TOKEN')
    expect((await reset(lastToken(), 'Brand-new-pass-1')).status).toBe(204)
  })

  it('ลิงก์หมดอายุใช้ไม่ได้', async () => {
    const user = await createUser()
    await forgot(user.email)
    await prisma.passwordResetToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    expect((await reset(lastToken(), 'Brand-new-pass-1')).body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('token มั่ว -> ข้อความเดียวกับลิงก์หมดอายุ', async () => {
    expect((await reset('x'.repeat(43), 'Brand-new-pass-1')).body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('admin ต้องตั้งรหัสอย่างน้อย 12 ตัว และลิงก์ยังใช้ต่อได้ถ้ารหัสสั้นไป', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    await forgot(admin.email)
    const token = lastToken()
    expect((await reset(token, 'only-10-ch')).body.error.code).toBe('PASSWORD_TOO_SHORT')
    expect((await reset(token, 'long-enough-pass')).status).toBe(204)
    await loginAdmin(admin.email, 'long-enough-pass')
  })

  it('ขอลิงก์จากหน้า admin ก็ได้ (ไม่มีข้อจำกัดเรื่อง origin นอกจาก CSRF)', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    expect((await adminAgent().post('/api/auth/forgot-password').send({ email: admin.email })).status).toBe(204)
    expect(devOutbox).toHaveLength(1)
  })
})

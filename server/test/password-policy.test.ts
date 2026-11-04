import { beforeEach, describe, expect, it } from 'vitest'
import { env } from '../src/config/env.js'
import { devOutbox } from '../src/lib/mailer.js'
import { hashPassword, isGuessablePassword } from '../src/lib/password.js'
import { prisma } from '../src/lib/prisma.js'
import { adminAgent, createUser, eventsOf, loginAdmin, loginUser, PASSWORD, signedInAdmin, signedInUser, userAgent } from './helpers.js'

beforeEach(() => {
  devOutbox.length = 0
})

const EMAIL = 'someone@test.local'

describe('isGuessablePassword', () => {
  it.each([
    'password',
    'Password123',
    'p@ssw0rd!',
    'qwertyui',
    'iuytrewq',
    '12345678',
    '87654321',
    'abcdefgh',
    'aaaaaaaa',
    'abababab',
    '11112222',
    '0812345678',
    '!@#$%^&*',
    '1q2w3e4r',
    'dragon2024',
    'iloveyou!',
    '1loveyou',
    '123password',
    'pokemon123',
    'tcgnexus2024',
    'My-SwapHub-Pass',
  ])('ปฏิเสธ %s', (password) => {
    expect(isGuessablePassword(password, EMAIL)).toBe(true)
  })

  it.each([
    'correct horse battery',
    'รหัสผ่านของฉันยาวมาก',
    'Tr4de-My-Ch4rizard',
    'Brand-new-pass-1',
    PASSWORD,
  ])('รับ %s', (password) => {
    expect(isGuessablePassword(password, EMAIL)).toBe(false)
  })

  it('มีชื่อหน้าอีเมลอยู่ในรหัส -> ปฏิเสธ แต่ชื่อสั้นมากไม่นับ', () => {
    expect(isGuessablePassword('Alice-likes-99', 'alice@test.local')).toBe(true)
    expect(isGuessablePassword('Dannie-likes-99', 'ann@test.local')).toBe(false)
  })
})

describe('บังคับตอนตั้งรหัส', () => {
  const body = (email: string, password: string) => ({ email, password, displayName: 'New' })

  it('สมัครด้วยรหัสเดาง่ายไม่ได้ และไม่สร้างบัญชี', async () => {
    const res = await userAgent().post('/api/auth/register').send(body('weak@test.local', 'password123'))
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('PASSWORD_TOO_COMMON')
    expect(await prisma.user.count()).toBe(0)
  })

  it('เปลี่ยนเป็นรหัสเดาง่ายไม่ได้ รหัสเดิมยังใช้ได้ และไม่ส่งอีเมลแจ้ง', async () => {
    const { user, agent } = await signedInUser()
    const res = await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'qwertyui' })
    expect(res.body.error.code).toBe('PASSWORD_TOO_COMMON')
    await loginUser(user.email)
    expect(devOutbox).toHaveLength(0)
  })

  it('รีเซ็ตเป็นรหัสเดาง่ายไม่ได้ และลิงก์ยังใช้ต่อได้', async () => {
    const user = await createUser()
    await userAgent().post('/api/auth/forgot-password').send({ email: user.email })
    const token = new URL(devOutbox.at(-1)?.text.match(/https?:\/\/\S+/)?.[0] ?? '').searchParams.get('token')
    const reset = (newPassword: string) => userAgent().post('/api/auth/reset-password').send({ token, newPassword })
    expect((await reset('password123')).body.error.code).toBe('PASSWORD_TOO_COMMON')
    expect((await reset('Brand-new-pass-1')).status).toBe(204)
  })

  it('รหัสเดิมที่เดาง่ายยังล็อกอินได้ บังคับแค่ตอนตั้งใหม่', async () => {
    const user = await createUser({ passwordHash: await hashPassword('password123') })
    await loginUser(user.email, 'password123')
  })
})

describe('อีเมลแจ้งเมื่อรหัสเปลี่ยน', () => {
  it('เปลี่ยนรหัสแล้วเจ้าของได้อีเมล พร้อมลิงก์ไปเว็บของตัวเอง', async () => {
    const { user, agent } = await signedInUser()
    await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'Another-pass-1' })
    expect(devOutbox).toHaveLength(1)
    expect(devOutbox[0]?.to).toBe(user.email)
    expect(devOutbox[0]?.text).toContain(`${new URL(env.CLIENT_ORIGIN).origin}/forgot-password`)
    // อีเมลต้องไม่มีรหัสผ่านติดไป
    expect(devOutbox[0]?.text).not.toContain('Another-pass-1')
  })

  it('admin ได้ลิงก์ไปเว็บหลังบ้าน', async () => {
    const { agent } = await signedInAdmin()
    await agent.post('/api/auth/change-password').send({ currentPassword: PASSWORD, newPassword: 'Another-long-pass-1' })
    expect(devOutbox[0]?.text).toContain(`${new URL(env.ADMIN_ORIGIN).origin}/forgot-password`)
  })

  it('รีเซ็ตรหัสสำเร็จก็ได้อีเมลแจ้ง', async () => {
    const user = await createUser()
    await userAgent().post('/api/auth/forgot-password').send({ email: user.email })
    const token = new URL(devOutbox.at(-1)?.text.match(/https?:\/\/\S+/)?.[0] ?? '').searchParams.get('token')
    await userAgent().post('/api/auth/reset-password').send({ token, newPassword: 'Brand-new-pass-1' })
    expect(devOutbox).toHaveLength(2)
    expect(devOutbox[1]).toMatchObject({ to: user.email, subject: expect.stringContaining('ถูกเปลี่ยน') })
  })
})

describe('admin ที่รหัสสั้นกว่ากำหนด', () => {
  const SHORT = 'short-pass'
  const adminLogin = (email: string, password: string) => adminAgent().post('/api/auth/admin/login').send({ email, password })

  it('ล็อกอินไม่ได้และไม่ได้ cookie ต้องตั้งรหัสใหม่ก่อน', async () => {
    const admin = await createUser({ role: 'ADMIN', passwordHash: await hashPassword(SHORT) })
    const res = await adminLogin(admin.email, SHORT)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ADMIN_PASSWORD_TOO_SHORT')
    expect(res.headers['set-cookie']).toBeUndefined()
    expect((await eventsOf('LOGIN_FAILED'))[0]).toMatchObject({ email: admin.email, detail: 'ADMIN_PASSWORD_TOO_SHORT' })
  })

  it('รหัสผิดยังตอบเหมือนเดิม ไม่บอกว่าบัญชีนี้รหัสสั้น', async () => {
    const admin = await createUser({ role: 'ADMIN', passwordHash: await hashPassword(SHORT) })
    expect((await adminLogin(admin.email, 'wrong')).body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('user ที่รหัสสั้นถูกตั้งเป็น admin ต้องตั้งรหัสใหม่ผ่านลืมรหัสผ่าน แล้วจึงเข้าได้', async () => {
    const boss = await signedInAdmin()
    const user = await createUser({ passwordHash: await hashPassword(SHORT) })
    expect((await boss.agent.patch(`/api/admin/users/${user.id}/role`).send({ role: 'ADMIN' })).status).toBe(200)
    expect((await adminLogin(user.email, SHORT)).body.error.code).toBe('ADMIN_PASSWORD_TOO_SHORT')

    await adminAgent().post('/api/auth/forgot-password').send({ email: user.email })
    const token = new URL(devOutbox.at(-1)?.text.match(/https?:\/\/\S+/)?.[0] ?? '').searchParams.get('token')
    expect((await adminAgent().post('/api/auth/reset-password').send({ token, newPassword: 'still-short' })).body.error.code).toBe(
      'PASSWORD_TOO_SHORT',
    )
    expect((await adminAgent().post('/api/auth/reset-password').send({ token, newPassword: 'Long-enough-pass-1' })).status).toBe(204)
    await loginAdmin(user.email, 'Long-enough-pass-1')
  })
})

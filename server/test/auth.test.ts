import { describe, expect, it } from 'vitest'
import { adminAgent, createUser, eventsOf, loginUser, PASSWORD, signedInAdmin, signedInUser, userAgent } from './helpers.js'

describe('register & login', () => {
  it('สมัครแล้วได้ session และบันทึก REGISTER', async () => {
    const agent = userAgent()
    const res = await agent.post('/api/auth/register').send({ email: 'New@Test.local', password: PASSWORD, displayName: 'New' })
    expect(res.status).toBe(201)
    // อีเมลถูกเก็บเป็นตัวพิมพ์เล็ก กันสมัครซ้ำด้วยตัวพิมพ์ต่างกัน
    expect(res.body.user).toMatchObject({ email: 'new@test.local', role: 'USER' })
    expect(res.body.user.passwordHash).toBeUndefined()
    expect((await agent.get('/api/auth/me')).status).toBe(200)
    expect(await eventsOf('REGISTER')).toHaveLength(1)
  })

  it('สมัครอีเมลซ้ำ -> EMAIL_TAKEN', async () => {
    const user = await createUser()
    const res = await userAgent().post('/api/auth/register').send({ email: user.email, password: PASSWORD, displayName: 'X' })
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
  })

  it('ไม่มี Origin -> 403 (กัน CSRF)', async () => {
    const user = await createUser()
    const { default: request } = await import('supertest')
    const { app } = await import('../src/app.js')
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD })
    expect(res.body.error.code).toBe('INVALID_ORIGIN')
  })

  it('รหัสผิด -> 401 และบันทึก LOGIN_FAILED พร้อมอีเมลที่ลอง แต่ไม่เก็บรหัส', async () => {
    const user = await createUser()
    const res = await userAgent().post('/api/auth/login').send({ email: user.email, password: 'wrong-password' })
    expect(res.status).toBe(401)
    const [event] = await eventsOf('LOGIN_FAILED')
    expect(event).toMatchObject({ email: user.email, detail: 'INVALID_CREDENTIALS', statusCode: 401 })
    expect(JSON.stringify(event)).not.toContain('wrong-password')
  })

  it('บัญชีที่ถูกระงับล็อกอินไม่ได้', async () => {
    const user = await createUser({ status: 'SUSPENDED' })
    const res = await userAgent().post('/api/auth/login').send({ email: user.email, password: PASSWORD })
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED')
  })
})

describe('หน้า login แยก user / admin', () => {
  it('user ที่หน้า user ได้, ที่หน้า admin ได้ 401 แบบเดียวกับรหัสผิด', async () => {
    const user = await createUser()
    expect((await userAgent().post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(200)
    const res = await adminAgent().post('/api/auth/admin/login').send({ email: user.email, password: PASSWORD })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('admin ที่หน้า admin ได้, ที่หน้า user ได้ USE_ADMIN_LOGIN และไม่ได้ cookie', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    expect((await adminAgent().post('/api/auth/admin/login').send({ email: admin.email, password: PASSWORD })).status).toBe(200)
    const res = await userAgent().post('/api/auth/login').send({ email: admin.email, password: PASSWORD })
    expect(res.body.error.code).toBe('USE_ADMIN_LOGIN')
    expect(res.headers['set-cookie']).toBeUndefined()
  })
})

describe('logout', () => {
  it('logout แล้ว session ใช้ไม่ได้ และบันทึก LOGOUT', async () => {
    const { agent } = await signedInUser()
    expect((await agent.post('/api/auth/logout')).status).toBe(204)
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect(await eventsOf('LOGOUT')).toHaveLength(1)
  })

  it('logout-all เตะทุกอุปกรณ์', async () => {
    const { user, agent } = await signedInUser()
    const other = await loginUser(user.email)
    expect((await agent.post('/api/auth/logout-all')).status).toBe(204)
    expect((await other.get('/api/auth/me')).status).toBe(401)
  })
})

describe('change password', () => {
  const change = (agent: ReturnType<typeof userAgent>, currentPassword: string, newPassword: string) =>
    agent.post('/api/auth/change-password').send({ currentPassword, newPassword })

  it('ไม่ login -> 401', async () => {
    expect((await change(userAgent(), PASSWORD, 'Another-pass-1')).status).toBe(401)
  })

  it('รหัสเดิมผิด -> 400 (ไม่ใช่ 401 เพราะ client จะเด้งออก) และ session ยังอยู่', async () => {
    const { agent } = await signedInUser()
    const res = await change(agent, 'wrong-password', 'Another-pass-1')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_CURRENT_PASSWORD')
    expect((await agent.get('/api/auth/me')).status).toBe(200)
  })

  it('รหัสใหม่สั้นหรือซ้ำของเดิม -> ปฏิเสธ', async () => {
    const { agent } = await signedInUser()
    expect((await change(agent, PASSWORD, 'short')).body.error.code).toBe('VALIDATION_ERROR')
    expect((await change(agent, PASSWORD, PASSWORD)).body.error.code).toBe('PASSWORD_UNCHANGED')
  })

  it('เปลี่ยนสำเร็จ: เครื่องนี้อยู่ต่อ อุปกรณ์อื่นหลุด รหัสเก่าใช้ไม่ได้', async () => {
    const { user, agent } = await signedInUser()
    const other = await loginUser(user.email)
    expect((await change(agent, PASSWORD, 'Another-pass-1')).status).toBe(204)
    expect((await agent.get('/api/auth/me')).status).toBe(200)
    expect((await other.get('/api/auth/me')).status).toBe(401)
    expect((await userAgent().post('/api/auth/login').send({ email: user.email, password: PASSWORD })).status).toBe(401)
    await loginUser(user.email, 'Another-pass-1')
    expect(await eventsOf('PASSWORD_CHANGED')).toHaveLength(1)
  })

  it('admin ต้องตั้งรหัสอย่างน้อย 12 ตัว', async () => {
    const { agent } = await signedInAdmin()
    expect((await change(agent, PASSWORD, 'only-10-ch')).body.error.code).toBe('PASSWORD_TOO_SHORT')
    expect((await change(agent, PASSWORD, 'long-enough-pass')).status).toBe(204)
  })
})

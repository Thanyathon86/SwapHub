import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { createUser, loginAdmin, loginUser, signedInAdmin, signedInUser, type Agent } from './helpers.js'

let admin: Agent
let adminId: string

beforeEach(async () => {
  const a = await signedInAdmin()
  admin = a.agent
  adminId = a.user.id
})

const setRole = (agent: Agent, id: string, role: string) => agent.patch(`/api/admin/users/${id}/role`).send({ role })
const setStatus = (agent: Agent, id: string, status: string) => agent.patch(`/api/admin/users/${id}/status`).send({ status })
const actions = async () =>
  (await prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })).map((l) => ({
    action: l.action,
    actorId: l.actorId,
    targetUserId: l.targetUserId,
  }))

describe('สิทธิ์เข้า API admin', () => {
  it('user ธรรมดาเรียกไม่ได้ และบันทึก ACCESS_DENIED', async () => {
    const { user, agent } = await signedInUser()
    expect((await agent.get('/api/admin/users')).status).toBe(403)
    expect((await setRole(agent, user.id, 'ADMIN')).status).toBe(403)
    expect(await prisma.eventLog.count({ where: { type: 'ACCESS_DENIED' } })).toBeGreaterThan(0)
  })
})

describe('ตั้ง / ถอดสิทธิ์ admin', () => {
  it('ตั้งเป็น admin: session เดิมถูกลบ และลง audit log', async () => {
    const { user, agent } = await signedInUser()
    const res = await setRole(admin, user.id, 'ADMIN')
    expect(res.body.user.role).toBe('ADMIN')
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect(await actions()).toEqual([{ action: 'USER_PROMOTED', actorId: adminId, targetUserId: user.id }])
    await loginAdmin(user.email)
  })

  it('ถอดสิทธิ์ admin คนอื่นได้ และกลับไปล็อกอินหน้า user ได้', async () => {
    const other = await createUser({ role: 'ADMIN' })
    expect((await setRole(admin, other.id, 'USER')).body.user.role).toBe('USER')
    await loginUser(other.email)
  })

  it('แก้ตัวเองไม่ได้, ตั้งซ้ำไม่ได้, ตั้งบัญชีที่ถูกระงับไม่ได้, role แปลก ๆ ไม่ได้', async () => {
    const suspended = await createUser({ status: 'SUSPENDED' })
    const user = await createUser()
    expect((await setRole(admin, adminId, 'USER')).body.error.code).toBe('CANNOT_MODIFY_SELF')
    expect((await setRole(admin, user.id, 'USER')).body.error.code).toBe('ROLE_UNCHANGED')
    expect((await setRole(admin, suspended.id, 'ADMIN')).body.error.code).toBe('USER_NOT_ACTIVE')
    expect((await setRole(admin, user.id, 'SUPER')).body.error.code).toBe('VALIDATION_ERROR')
  })

  it('admin สองคนถอดสิทธิ์กันพร้อมกัน ต้องเหลือ admin อย่างน้อยหนึ่งคน', async () => {
    const b = await signedInAdmin()
    await Promise.all([setRole(admin, b.user.id, 'USER'), setRole(b.agent, adminId, 'USER')])
    expect(await prisma.user.count({ where: { role: 'ADMIN' } })).toBeGreaterThanOrEqual(1)
  })
})

describe('ระงับ / ปลดระงับ', () => {
  it('ระงับแล้วผู้ใช้หลุดทันที กดซ้ำไม่ลง log ซ้ำ', async () => {
    const { user, agent } = await signedInUser()
    await setStatus(admin, user.id, 'SUSPENDED')
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    await setStatus(admin, user.id, 'SUSPENDED')
    await setStatus(admin, user.id, 'ACTIVE')
    expect((await actions()).map((a) => a.action)).toEqual(['USER_SUSPENDED', 'USER_REACTIVATED'])
  })

  it('ระงับ admin ตรง ๆ ไม่ได้', async () => {
    const other = await createUser({ role: 'ADMIN' })
    expect((await setStatus(admin, other.id, 'SUSPENDED')).body.error.code).toBe('CANNOT_MODIFY_ADMIN')
  })
})

describe('รายการผู้ใช้และ audit log', () => {
  it('กรองตาม role ได้', async () => {
    await createUser()
    const res = await admin.get('/api/admin/users?role=ADMIN')
    expect(res.body.users.map((u: { id: string }) => u.id)).toEqual([adminId])
  })

  it('GET /api/admin/audit-logs มีชื่อผู้ทำและผู้ถูกแก้', async () => {
    const user = await createUser({ displayName: 'Target' })
    await setStatus(admin, user.id, 'SUSPENDED')
    const res = await admin.get('/api/admin/audit-logs')
    expect(res.body.logs[0]).toMatchObject({ action: 'USER_SUSPENDED', targetUser: { displayName: 'Target' } })
  })
})

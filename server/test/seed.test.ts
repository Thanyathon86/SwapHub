import { describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { seedAdmin } from '../src/scripts/seedAdmin.js'
import { createUser, loginAdmin, PASSWORD, signedInUser } from './helpers.js'

const STRONG = 'Tr4de-My-Ch4rizard-99'

describe('seed admin คนแรก', () => {
  it('สร้าง admin จากอีเมลใหม่ และล็อกอินหลังบ้านได้', async () => {
    await seedAdmin(' Boss@Test.Local ', STRONG)
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'boss@test.local' } })
    expect(admin.role).toBe('ADMIN')
    await loginAdmin(admin.email, STRONG)
  })

  it('รันซ้ำได้ ไม่ทับรหัสผ่านเดิมของ admin', async () => {
    const admin = await createUser({ role: 'ADMIN' })
    await seedAdmin(admin.email, STRONG)
    await loginAdmin(admin.email, PASSWORD)
    expect(await prisma.user.count()).toBe(1)
  })

  it('ไม่ยกบัญชีผู้ใช้ที่มีอยู่แล้วเป็น admin คนที่สมัครอีเมลนี้ดักไว้จะไม่ได้สิทธิ์', async () => {
    const { user, agent } = await signedInUser()
    await expect(seedAdmin(user.email, STRONG)).rejects.toThrow('existing user account')
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe('USER')
    // session เดิมของคนนั้นยังไม่มีสิทธิ์หลังบ้าน
    expect((await agent.get('/api/admin/counts')).status).toBe(403)
  })

  it.each(['CHANGE_ME_AT_LEAST_12', 'change-me-please-now', 'password123456', 'boss-is-the-admin'])(
    'ไม่รับรหัสตัวอย่างหรือรหัสเดาง่าย: %s',
    async (password) => {
      await expect(seedAdmin('boss@test.local', password)).rejects.toThrow('ADMIN_PASSWORD')
      expect(await prisma.user.count()).toBe(0)
    },
  )
})

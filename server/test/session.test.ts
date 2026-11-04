import { describe, expect, it } from 'vitest'
import { env } from '../src/config/env.js'
import { prisma } from '../src/lib/prisma.js'
import { signedInAdmin, signedInUser } from './helpers.js'

const HOUR_MS = 60 * 60 * 1000
const fromNow = (hours: number) => new Date(Date.now() + hours * HOUR_MS)
const hoursLeft = async (userId: string) => {
  const { expiresAt } = await prisma.session.findFirstOrThrow({ where: { userId } })
  return (expiresAt.getTime() - Date.now()) / HOUR_MS
}

describe('อายุ session', () => {
  it('admin ได้ session สั้นกว่าผู้ใช้ทั่วไป', async () => {
    const admin = await signedInAdmin()
    const user = await signedInUser()
    expect(await hoursLeft(admin.user.id)).toBeCloseTo(env.ADMIN_SESSION_TTL_HOURS, 1)
    expect(await hoursLeft(user.user.id)).toBeCloseTo(env.SESSION_TTL_DAYS * 24, 1)
  })

  it('admin ที่ใช้งานอยู่ได้ต่ออายุ เมื่อเหลือไม่ถึงครึ่ง', async () => {
    const { user, agent } = await signedInAdmin()
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: fromNow(0.5) } })
    const res = await agent.get('/api/auth/me')
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toBeDefined()
    expect(await hoursLeft(user.id)).toBeCloseTo(env.ADMIN_SESSION_TTL_HOURS, 1)
  })

  it('admin ต่ออายุเกินเพดานนับจากล็อกอินไม่ได้', async () => {
    const { user, agent } = await signedInAdmin()
    // ล็อกอินมานานจนเหลืออีกแค่ครึ่งชั่วโมงก็ถึงเพดาน
    const createdAt = fromNow(0.5 - env.ADMIN_SESSION_ABSOLUTE_HOURS)
    await prisma.session.updateMany({ where: { userId: user.id }, data: { createdAt, expiresAt: fromNow(0.1) } })
    expect((await agent.get('/api/auth/me')).status).toBe(200)
    expect(await hoursLeft(user.id)).toBeCloseTo(0.5, 1)
  })

  it('admin ที่เกินเพดานหลุดทันที แม้ expiresAt ยังไม่ถึง (session ที่สร้างก่อนปรับอายุให้สั้นลง)', async () => {
    const { user, agent } = await signedInAdmin()
    const createdAt = fromNow(-env.ADMIN_SESSION_ABSOLUTE_HOURS - 1)
    await prisma.session.updateMany({ where: { userId: user.id }, data: { createdAt, expiresAt: fromNow(5 * 24) } })
    expect((await agent.get('/api/auth/me')).status).toBe(401)
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
  })

  it('เพดานของ admin ไม่กระทบผู้ใช้ทั่วไป', async () => {
    const { user, agent } = await signedInUser()
    const createdAt = fromNow(-env.ADMIN_SESSION_ABSOLUTE_HOURS - 1)
    await prisma.session.updateMany({ where: { userId: user.id }, data: { createdAt } })
    expect((await agent.get('/api/auth/me')).status).toBe(200)
  })

  it('ผู้ใช้ทั่วไปยังหลุดเมื่อเกินเพดานของตัวเอง', async () => {
    const { user, agent } = await signedInUser()
    const createdAt = fromNow(-env.SESSION_ABSOLUTE_DAYS * 24 - 1)
    await prisma.session.updateMany({ where: { userId: user.id }, data: { createdAt } })
    expect((await agent.get('/api/auth/me')).status).toBe(401)
  })
})

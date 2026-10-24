import type { Request } from 'express'
import { describe, expect, it } from 'vitest'
import { deleteOldEvents, logEventThrottled } from '../src/lib/events.js'
import { prisma } from '../src/lib/prisma.js'
import { createListing, createUser, eventsOf, signedInAdmin, userAgent } from './helpers.js'

const DAY = 24 * 60 * 60 * 1000
const todayInThailand = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })

describe('GET /api/admin/dashboard', () => {
  it('มีครบทุกส่วน และกราฟ 30 วันจบที่วันนี้ตามเวลาไทย', async () => {
    const { agent } = await signedInAdmin()
    const seller = await createUser()
    await createListing(seller.id, { status: 'PENDING_REVIEW', createdAt: new Date(Date.now() - 2 * DAY) })
    await createListing(seller.id)
    await userAgent().post('/api/auth/login').send({ email: seller.email, password: 'wrong-password' })

    const { body } = await agent.get('/api/admin/dashboard')
    expect(body.attention).toMatchObject({ pendingListings: 1, pendingListingsOver24h: 1, pendingOffers: 0, openTickets: 0 })
    expect(body.totals).toMatchObject({ users: 2, activeListings: 1, suspendedUsers: 0 })
    expect(body.daily).toHaveLength(30)
    expect(body.daily.at(-1)).toMatchObject({ day: todayInThailand(), users: 2 })
    expect(body.listingsByGame.reduce((n: number, g: { activeListings: number }) => n + g.activeListings, 0)).toBe(1)
    expect(body.security24h.loginFailed).toBe(1)
  })

  it('endpoint เก่า /api/admin/stats ไม่มีแล้ว', async () => {
    const { agent } = await signedInAdmin()
    expect((await agent.get('/api/admin/stats')).status).toBe(404)
  })
})

describe('event log', () => {
  const fakeReq = { ip: '203.0.113.9', method: 'GET', originalUrl: '/api/x?secret=1', get: () => 'test-agent' } as unknown as Request

  it('throttle: เรียกซ้ำใน window เดียวกันบันทึกครั้งเดียว และตัด query string', async () => {
    for (let i = 0; i < 3; i++) logEventThrottled('test-throttle', 60_000, fakeReq, { type: 'RATE_LIMITED', statusCode: 429 })
    const events = await eventsOf('RATE_LIMITED')
    expect(events).toHaveLength(1)
    expect(events[0]?.path).toBe('/api/x')
  })

  it('ลบ log เก่ากว่า 60 วัน เก็บของที่ยังไม่ถึง', async () => {
    const [old, recent] = await Promise.all([
      prisma.eventLog.create({ data: { type: 'LOGOUT', createdAt: new Date(Date.now() - 61 * DAY) } }),
      prisma.eventLog.create({ data: { type: 'LOGOUT', createdAt: new Date(Date.now() - 59 * DAY) } }),
    ])
    await deleteOldEvents()
    const left = await prisma.eventLog.findMany({ where: { id: { in: [old.id, recent.id] } } })
    expect(left.map((e) => e.id)).toEqual([recent.id])
  })

  it('GET /api/admin/events กรองประเภทได้ และประเภทผิดได้ 400', async () => {
    const { agent } = await signedInAdmin()
    await userAgent().post('/api/auth/login').send({ email: 'nobody@test.local', password: 'x' })
    const res = await agent.get('/api/admin/events?type=LOGIN_FAILED')
    expect(res.body.events.every((e: { type: string }) => e.type === 'LOGIN_FAILED')).toBe(true)
    expect(res.body.events.length).toBeGreaterThan(0)
    expect((await agent.get('/api/admin/events?type=NOPE')).status).toBe(400)
  })
})

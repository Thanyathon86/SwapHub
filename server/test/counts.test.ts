import { describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { createListing, createUser, signedInAdmin, signedInUser, userAgent } from './helpers.js'

describe('GET /api/me/counts', () => {
  it('ต้องล็อกอิน', async () => {
    expect((await userAgent().get('/api/me/counts')).status).toBe(401)
  })

  it('นับข้อเสนอที่รอเราตอบ และเรื่องที่ทีมงานตอบแล้ว เฉพาะของเรา', async () => {
    const seller = await signedInUser()
    const buyer = await signedInUser()
    const listing = await createListing(seller.user.id)
    await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
    await prisma.supportTicket.create({ data: { userId: seller.user.id, subject: 's', category: 'OTHER', status: 'ANSWERED' } })
    await prisma.supportTicket.create({ data: { userId: seller.user.id, subject: 's', category: 'OTHER', status: 'OPEN' } })

    expect((await seller.agent.get('/api/me/counts')).body).toEqual({ incomingOffers: 1, answeredTickets: 1 })
    // ฝั่งผู้ซื้อไม่มีอะไรรอตอบ
    expect((await buyer.agent.get('/api/me/counts')).body).toEqual({ incomingOffers: 0, answeredTickets: 0 })
  })
})

describe('GET /api/admin/counts', () => {
  it('นับประกาศรอตรวจและเรื่องที่รอทีมงานตอบ', async () => {
    const { agent } = await signedInAdmin()
    const user = await createUser()
    await createListing(user.id, { status: 'PENDING_REVIEW' })
    await createListing(user.id)
    await prisma.supportTicket.create({ data: { userId: user.id, subject: 's', category: 'OTHER' } })
    expect((await agent.get('/api/admin/counts')).body).toEqual({ pendingListings: 1, openTickets: 1 })
  })

  it('user ธรรมดาเรียกไม่ได้', async () => {
    const { agent } = await signedInUser()
    expect((await agent.get('/api/admin/counts')).status).toBe(403)
  })
})

import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { createListing, signedInUser, type Agent } from './helpers.js'

type Party = { agent: Agent; id: string; username: string }
let seller: Party
let buyer: Party

const party = async (): Promise<Party> => {
  const { user, agent } = await signedInUser()
  return { agent, id: user.id, username: user.username }
}

// ดีลที่ตอบรับแล้วหนึ่งดีล คืน id ของ offer
const acceptedDeal = async () => {
  const listing = await createListing(seller.id, { quantity: 5 })
  const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
  await seller.agent.post(`/api/offers/${body.offer.id}/accept`)
  return body.offer.id as string
}

const review = (agent: Agent, offerId: string, body: object) => agent.put(`/api/offers/${offerId}/review`).send(body)

beforeEach(async () => {
  seller = await party()
  buyer = await party()
})

describe('ให้คะแนน', () => {
  it('ทั้งสองฝ่ายให้คะแนนกันได้ คนละหนึ่งรีวิว ผู้รับคืออีกฝ่ายเสมอ', async () => {
    const offerId = await acceptedDeal()
    expect((await review(buyer.agent, offerId, { rating: 5, comment: 'ส่งไว แพ็คดี' })).status).toBe(200)
    expect((await review(seller.agent, offerId, { rating: 4 })).status).toBe(200)
    const rows = await prisma.review.findMany({ orderBy: { rating: 'desc' } })
    expect(rows.map((r) => [r.reviewerId, r.revieweeId, r.rating])).toEqual([
      [buyer.id, seller.id, 5],
      [seller.id, buyer.id, 4],
    ])
  })

  it('ให้ซ้ำ = แก้รีวิวเดิม ไม่สร้างใหม่', async () => {
    const offerId = await acceptedDeal()
    await review(buyer.agent, offerId, { rating: 2, comment: 'ยังไม่ได้ของ' })
    const res = await review(buyer.agent, offerId, { rating: 5, comment: '' })
    expect(res.body.review).toMatchObject({ rating: 5, comment: null })
    expect(await prisma.review.count()).toBe(1)
  })

  it('คนนอกดีลให้ไม่ได้ (404)', async () => {
    const offerId = await acceptedDeal()
    const stranger = await party()
    expect((await review(stranger.agent, offerId, { rating: 1 })).body.error.code).toBe('OFFER_NOT_FOUND')
  })

  it('ดีลที่ยังไม่ตอบรับหรือถูกปฏิเสธให้ไม่ได้', async () => {
    const listing = await createListing(seller.id)
    const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
    expect((await review(buyer.agent, body.offer.id, { rating: 5 })).body.error.code).toBe('OFFER_NOT_ACCEPTED')
    await seller.agent.post(`/api/offers/${body.offer.id}/decline`)
    expect((await review(seller.agent, body.offer.id, { rating: 1 })).body.error.code).toBe('OFFER_NOT_ACCEPTED')
  })

  it('เกิน 30 วันหลังตอบรับ ให้หรือแก้ไม่ได้', async () => {
    const offerId = await acceptedDeal()
    await prisma.offer.update({ where: { id: offerId }, data: { respondedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000) } })
    expect((await review(buyer.agent, offerId, { rating: 5 })).body.error.code).toBe('REVIEW_WINDOW_CLOSED')
  })

  it('คะแนนต้องเป็นจำนวนเต็ม 1-5 และข้อความไม่เกิน 500', async () => {
    const offerId = await acceptedDeal()
    for (const body of [{ rating: 0 }, { rating: 6 }, { rating: 4.5 }, { rating: 5, comment: 'x'.repeat(501) }]) {
      expect((await review(buyer.agent, offerId, body)).body.error.code).toBe('VALIDATION_ERROR')
    }
  })
})

describe('แสดงคะแนน', () => {
  it('ค่าเฉลี่ยปัดทศนิยมหนึ่งตำแหน่ง แสดงในโปรไฟล์ หน้าประกาศ และข้อเสนอ', async () => {
    for (const rating of [5, 4, 4]) {
      buyer = await party()
      await review(buyer.agent, await acceptedDeal(), { rating })
    }
    const expected = { average: 4.3, count: 3 }

    const profile = await request(app).get(`/api/users/${seller.username}`)
    expect(profile.body.profile.stats).toMatchObject({ deals: 3, rating: expected })

    const listing = await createListing(seller.id)
    expect((await request(app).get(`/api/listings/${listing.id}`)).body.listing.seller.rating).toEqual(expected)

    // ผู้ขายเห็นคะแนนของผู้ซื้อคนใหม่ (ยังไม่มีรีวิว) ตอนมีข้อเสนอเข้ามา
    const newcomer = await party()
    await newcomer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
    const incoming = await seller.agent.get('/api/offers/incoming')
    const pending = incoming.body.offers.find((o: { status: string }) => o.status === 'PENDING')
    expect(pending.buyer.rating).toEqual({ average: null, count: 0 })
    expect(pending.listing.seller.rating).toEqual(expected)
    expect(pending.reviewDeadline).toBeNull()
  })

  it('ข้อเสนอที่ตอบรับแล้วมีรีวิวของดีลและกำหนดเวลาแก้ไข', async () => {
    const offerId = await acceptedDeal()
    await review(buyer.agent, offerId, { rating: 5 })
    const { body } = await buyer.agent.get('/api/offers/outgoing')
    expect(body.offers[0].reviews).toEqual([{ reviewerId: buyer.id, rating: 5, comment: null, updatedAt: expect.any(String) }])
    expect(new Date(body.offers[0].reviewDeadline).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000)
  })

  it('GET /api/users/:username/reviews บอกว่ามาจากดีลไหน และไม่มีอีเมล', async () => {
    await review(buyer.agent, await acceptedDeal(), { rating: 5, comment: 'ดีมาก' })
    const res = await request(app).get(`/api/users/${seller.username}/reviews`)
    expect(res.body.total).toBe(1)
    expect(res.body.reviews[0]).toMatchObject({
      rating: 5,
      comment: 'ดีมาก',
      reviewerRole: 'BUYER',
      listingTitle: 'Pikachu',
      reviewer: { username: buyer.username },
    })
    expect(JSON.stringify(res.body)).not.toContain('@test.local')
  })
})

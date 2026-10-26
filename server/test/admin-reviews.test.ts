import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { createListing, signedInAdmin, signedInUser, type Agent } from './helpers.js'

type Party = { agent: Agent; id: string; username: string }
let seller: Party
let buyer: Party
let admin: Party

const party = async (): Promise<Party> => {
  const { user, agent } = await signedInUser()
  return { agent, id: user.id, username: user.username }
}

// ดีลที่ตอบรับแล้วและผู้ซื้อให้คะแนนผู้ขายแล้ว คืน id ของ offer กับ review
const reviewedDeal = async (rating = 1) => {
  const listing = await createListing(seller.id, { quantity: 5 })
  const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
  await seller.agent.post(`/api/offers/${body.offer.id}/accept`)
  const res = await buyer.agent.put(`/api/offers/${body.offer.id}/review`).send({ rating, comment: 'คำหยาบ' })
  return { offerId: body.offer.id as string, reviewId: res.body.review.id as string }
}

const remove = (agent: Agent, id: string, reason = 'ใช้คำไม่สุภาพ') =>
  agent.post(`/api/admin/reviews/${id}/remove`).send({ reason })

beforeEach(async () => {
  seller = await party()
  buyer = await party()
  const { user, agent } = await signedInAdmin()
  admin = { agent, id: user.id, username: user.username }
})

describe('admin ซ่อนรีวิว', () => {
  it('ซ่อนแล้วหายจากโปรไฟล์และไม่นับในคะแนนเฉลี่ย', async () => {
    const { reviewId } = await reviewedDeal(1)
    await reviewedDeal(5)

    expect((await remove(admin.agent, reviewId)).status).toBe(200)

    const profile = await buyer.agent.get(`/api/users/${seller.username}`)
    expect(profile.body.profile.stats.rating).toEqual({ average: 5, count: 1 })
    const reviews = await buyer.agent.get(`/api/users/${seller.username}/reviews`)
    expect(reviews.body.reviews.map((r: { rating: number }) => r.rating)).toEqual([5])
  })

  it('บันทึก audit log พร้อมเหตุผล ผู้ถูกกระทำคือคนเขียน', async () => {
    const { reviewId } = await reviewedDeal()
    await remove(admin.agent, reviewId, 'สแปม')
    const logs = await prisma.auditLog.findMany()
    expect(logs.map((l) => [l.actorId, l.action, l.targetUserId, l.detail])).toEqual([
      [admin.id, 'REVIEW_REMOVED', buyer.id, 'สแปม'],
    ])
  })

  it('ซ่อนซ้ำได้ 409 และไม่ลง log ซ้ำ', async () => {
    const { reviewId } = await reviewedDeal()
    await remove(admin.agent, reviewId)
    expect((await remove(admin.agent, reviewId)).body.error.code).toBe('REVIEW_ALREADY_REMOVED')
    expect(await prisma.auditLog.count()).toBe(1)
  })

  it('ต้องใส่เหตุผล และรีวิวที่ไม่มีได้ 404', async () => {
    const { reviewId } = await reviewedDeal()
    expect((await remove(admin.agent, reviewId, '  ')).body.error.code).toBe('VALIDATION_ERROR')
    const missing = await remove(admin.agent, '00000000-0000-4000-8000-000000000000')
    expect(missing.body.error.code).toBe('REVIEW_NOT_FOUND')
  })

  it('คนเขียนแก้หรือเขียนใหม่ในดีลเดิมไม่ได้ และในดีลเห็นแค่ว่าถูกซ่อน', async () => {
    const { offerId, reviewId } = await reviewedDeal()
    await remove(admin.agent, reviewId)

    const res = await buyer.agent.put(`/api/offers/${offerId}/review`).send({ rating: 5 })
    expect(res.body.error.code).toBe('REVIEW_REMOVED')

    const outgoing = await buyer.agent.get('/api/offers/outgoing')
    expect(outgoing.body.offers[0].reviews[0]).toMatchObject({ rating: null, comment: null })
    expect(outgoing.body.offers[0].reviews[0].removedAt).not.toBeNull()
  })

  it('ผู้ใช้ทั่วไปเรียก API ของ admin ไม่ได้', async () => {
    const { reviewId } = await reviewedDeal()
    expect((await remove(seller.agent, reviewId)).status).toBe(403)
    expect((await seller.agent.get('/api/admin/reviews')).status).toBe(403)
  })
})

describe('รายการรีวิวหลังบ้าน', () => {
  it('แยกรายการที่แสดงอยู่กับที่ซ่อนแล้ว และค้นด้วย username ได้', async () => {
    const first = await reviewedDeal()
    await reviewedDeal()
    await remove(admin.agent, first.reviewId)

    const visible = await admin.agent.get('/api/admin/reviews')
    expect(visible.body.total).toBe(1)
    const removed = await admin.agent.get('/api/admin/reviews?status=REMOVED')
    expect(removed.body.reviews.map((r: { id: string }) => r.id)).toEqual([first.reviewId])
    expect(removed.body.reviews[0]).toMatchObject({ removeReason: 'ใช้คำไม่สุภาพ', removedBy: { id: admin.id } })

    const stranger = await party()
    expect((await admin.agent.get(`/api/admin/reviews?q=${stranger.username}`)).body.total).toBe(0)
    expect((await admin.agent.get(`/api/admin/reviews?q=${seller.username.toUpperCase()}`)).body.total).toBe(1)
  })
})

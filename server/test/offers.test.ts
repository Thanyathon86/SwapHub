import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { createListing, signedInAdmin, signedInUser, type Agent } from './helpers.js'

type Ctx = { seller: Agent; buyer: Agent; sellerId: string; buyerId: string }
let ctx: Ctx

beforeEach(async () => {
  const s = await signedInUser()
  const b = await signedInUser()
  ctx = { seller: s.agent, buyer: b.agent, sellerId: s.user.id, buyerId: b.user.id }
})

const offer = (agent: Agent, body: object) => agent.post('/api/offers').send(body)

describe('สร้าง offer: กฎที่ตรวจใน service', () => {
  it('ต้องมีเงินหรือของแลกอย่างน้อยหนึ่งอย่าง', async () => {
    const listing = await createListing(ctx.sellerId, { type: 'BOTH' })
    expect((await offer(ctx.buyer, { listingId: listing.id })).body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ส่ง offer ให้ประกาศของตัวเองไม่ได้', async () => {
    const listing = await createListing(ctx.sellerId)
    expect((await offer(ctx.seller, { listingId: listing.id, cashAmount: 10 })).body.error.code).toBe('CANNOT_OFFER_OWN_LISTING')
  })

  it('เอาของแลกกับประกาศขายอย่างเดียวไม่ได้', async () => {
    const sale = await createListing(ctx.sellerId, { type: 'SALE' })
    const mine = await createListing(ctx.buyerId, { type: 'TRADE', price: null })
    const res = await offer(ctx.buyer, { listingId: sale.id, items: [{ listingId: mine.id }] })
    expect(res.body.error.code).toBe('LISTING_NOT_TRADEABLE')
  })

  it('เสนอเงินอย่างเดียวกับประกาศแลกอย่างเดียวไม่ได้', async () => {
    const trade = await createListing(ctx.sellerId, { type: 'TRADE', price: null })
    expect((await offer(ctx.buyer, { listingId: trade.id, cashAmount: 10 })).body.error.code).toBe('LISTING_TRADE_ONLY')
  })

  it('ของที่เอามาแลกต้องเป็นประกาศ ACTIVE ของตัวเอง', async () => {
    const target = await createListing(ctx.sellerId, { type: 'BOTH' })
    const notMine = await createListing(ctx.sellerId, { type: 'TRADE', price: null })
    const pendingMine = await createListing(ctx.buyerId, { type: 'TRADE', price: null, status: 'PENDING_REVIEW' })
    for (const item of [notMine, pendingMine]) {
      const res = await offer(ctx.buyer, { listingId: target.id, items: [{ listingId: item.id }] })
      expect(res.body.error.code).toBe('INVALID_OFFER_ITEMS')
    }
  })

  it('ขอเกินจำนวนที่มีไม่ได้', async () => {
    const listing = await createListing(ctx.sellerId, { quantity: 2 })
    expect((await offer(ctx.buyer, { listingId: listing.id, quantity: 3, cashAmount: 10 })).body.error.code).toBe(
      'INSUFFICIENT_QUANTITY',
    )
  })

  it('มี offer PENDING กับประกาศเดียวกันได้ทีละอัน', async () => {
    const listing = await createListing(ctx.sellerId)
    expect((await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })).status).toBe(201)
    expect((await offer(ctx.buyer, { listingId: listing.id, cashAmount: 20 })).body.error.code).toBe('OFFER_ALREADY_PENDING')
  })
})

describe('ตอบรับ / ปฏิเสธ / ยกเลิก', () => {
  it('ตอบรับ: ตัดสต็อกทั้งสองฝั่ง ปิดประกาศที่หมด ยกเลิก offer อื่นที่ใช้การ์ดเดียวกัน และเปิดเผยอีเมล', async () => {
    const target = await createListing(ctx.sellerId, { type: 'BOTH', quantity: 2 })
    const myCard = await createListing(ctx.buyerId, { type: 'TRADE', price: null })
    const other = await createListing(ctx.sellerId, { type: 'TRADE', price: null })

    const created = await offer(ctx.buyer, { listingId: target.id, quantity: 2, cashAmount: 150, items: [{ listingId: myCard.id }] })
    expect(created.status).toBe(201)
    // ก่อนตอบรับห้ามเห็นอีเมลกัน
    expect(created.body.offer.buyer.email).toBeNull()
    expect(created.body.offer.listing.seller.email).toBeNull()
    const competing = await offer(ctx.buyer, { listingId: other.id, items: [{ listingId: myCard.id }] })

    const res = await ctx.seller.post(`/api/offers/${created.body.offer.id}/accept`)
    expect(res.body.offer.status).toBe('ACCEPTED')
    expect(res.body.offer.buyer.email).toMatch(/@test\.local$/)
    expect(res.body.offer.listing.seller.email).toMatch(/@test\.local$/)

    expect(await prisma.listing.findUnique({ where: { id: target.id } })).toMatchObject({ quantity: 0, status: 'CLOSED' })
    expect(await prisma.listing.findUnique({ where: { id: myCard.id } })).toMatchObject({ quantity: 0, status: 'CLOSED' })
    expect((await prisma.offer.findUnique({ where: { id: competing.body.offer.id } }))?.status).toBe('CANCELLED')
  })

  it('ผู้ขอกดตอบรับเองไม่ได้ (404) และตอบซ้ำไม่ได้ (409)', async () => {
    const listing = await createListing(ctx.sellerId)
    const { body } = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    expect((await ctx.buyer.post(`/api/offers/${body.offer.id}/accept`)).status).toBe(404)
    expect((await ctx.seller.post(`/api/offers/${body.offer.id}/decline`)).body.offer.status).toBe('DECLINED')
    expect((await ctx.seller.post(`/api/offers/${body.offer.id}/accept`)).body.error.code).toBe('OFFER_NOT_PENDING')
  })

  it('ผู้ขอยกเลิกได้', async () => {
    const listing = await createListing(ctx.sellerId)
    const { body } = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    expect((await ctx.buyer.post(`/api/offers/${body.offer.id}/cancel`)).body.offer.status).toBe('CANCELLED')
  })

  it('ตอบรับไม่ได้ถ้าสต็อกไม่พอแล้ว และ transaction ย้อนกลับทั้งหมด', async () => {
    const listing = await createListing(ctx.sellerId, { quantity: 1 })
    const { body } = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    await prisma.listing.update({ where: { id: listing.id }, data: { status: 'CLOSED' } })
    expect((await ctx.seller.post(`/api/offers/${body.offer.id}/accept`)).body.error.code).toBe('OFFER_NO_LONGER_VALID')
    expect((await prisma.offer.findUnique({ where: { id: body.offer.id } }))?.status).toBe('PENDING')
  })

  it('incoming / outgoing แยกตามฝั่ง', async () => {
    const listing = await createListing(ctx.sellerId)
    await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    expect((await ctx.seller.get('/api/offers/incoming')).body.offers).toHaveLength(1)
    expect((await ctx.seller.get('/api/offers/outgoing')).body.offers).toHaveLength(0)
    expect((await ctx.buyer.get('/api/offers/outgoing')).body.offers).toHaveLength(1)
  })
})

describe('บัญชีที่ถูกระงับ', () => {
  const statusOf = async (id: string) => (await prisma.offer.findUniqueOrThrow({ where: { id } })).status
  const suspend = async (userId: string, status: 'SUSPENDED' | 'ACTIVE' = 'SUSPENDED') =>
    (await signedInAdmin()).agent.patch(`/api/admin/users/${userId}/status`).send({ status })

  it('ระงับผู้ขอ -> ยกเลิกข้อเสนอที่ส่งไป ผู้ขายตอบรับไม่ได้และสต็อกไม่ถูกตัด', async () => {
    const listing = await createListing(ctx.sellerId)
    const { body } = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    expect((await suspend(ctx.buyerId)).status).toBe(200)
    expect(await statusOf(body.offer.id)).toBe('CANCELLED')
    expect((await ctx.seller.post(`/api/offers/${body.offer.id}/accept`)).body.error.code).toBe('OFFER_NOT_PENDING')
    expect(await prisma.listing.findUnique({ where: { id: listing.id } })).toMatchObject({ quantity: 1, status: 'ACTIVE' })
  })

  it('ระงับผู้ขาย -> ยกเลิกข้อเสนอที่เข้ามา ผู้ขอไม่ต้องรอเก้อ', async () => {
    const listing = await createListing(ctx.sellerId)
    const { body } = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    await suspend(ctx.sellerId)
    expect(await statusOf(body.offer.id)).toBe('CANCELLED')
  })

  it('ไม่กระทบข้อเสนอของคนอื่น และดีลที่ตกลงแล้วยังอยู่', async () => {
    const listing = await createListing(ctx.sellerId, { quantity: 2 })
    const other = await signedInUser()
    const accepted = await offer(other.agent, { listingId: listing.id, cashAmount: 10 })
    await ctx.seller.post(`/api/offers/${accepted.body.offer.id}/accept`)
    const third = await signedInUser()
    const untouched = await offer(third.agent, { listingId: listing.id, cashAmount: 10 })
    const mine = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })

    await suspend(ctx.buyerId)
    expect(await statusOf(mine.body.offer.id)).toBe('CANCELLED')
    expect(await statusOf(untouched.body.offer.id)).toBe('PENDING')
    expect(await statusOf(accepted.body.offer.id)).toBe('ACCEPTED')
  })

  it('ปลดระงับแล้วข้อเสนอเดิมไม่กลับมา', async () => {
    const listing = await createListing(ctx.sellerId)
    const { body } = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    await suspend(ctx.buyerId)
    await suspend(ctx.buyerId, 'ACTIVE')
    expect(await statusOf(body.offer.id)).toBe('CANCELLED')
  })

  it('ข้อเสนอที่ค้างจากก่อนมีกฎนี้ ตอบรับไม่ได้ ยังเป็น PENDING และสต็อกไม่ถูกตัด', async () => {
    const listing = await createListing(ctx.sellerId)
    const { body } = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    // แก้ใน DB ตรง ๆ จำลองบัญชีที่ถูกระงับก่อนหน้านี้ ซึ่งตอนนั้นไม่ได้ยกเลิกข้อเสนอให้
    await prisma.user.update({ where: { id: ctx.buyerId }, data: { status: 'SUSPENDED' } })
    const res = await ctx.seller.post(`/api/offers/${body.offer.id}/accept`)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('OFFER_PARTY_UNAVAILABLE')
    expect(await statusOf(body.offer.id)).toBe('PENDING')
    expect(await prisma.listing.findUnique({ where: { id: listing.id } })).toMatchObject({ quantity: 1, status: 'ACTIVE' })
    // ผู้ขายยังกดปฏิเสธเพื่อเคลียร์รายการได้
    expect((await ctx.seller.post(`/api/offers/${body.offer.id}/decline`)).body.offer.status).toBe('DECLINED')
  })
})

describe('ข้อมูลที่อีกฝ่ายเห็น', () => {
  it('เหตุผลที่ประกาศไม่ผ่านตรวจไม่ส่งถึงคู่ข้อเสนอ', async () => {
    const target = await createListing(ctx.sellerId, { type: 'BOTH' })
    const myCard = await createListing(ctx.buyerId, { type: 'TRADE', price: null })
    await offer(ctx.buyer, { listingId: target.id, items: [{ listingId: myCard.id }] })
    // ทั้งสองประกาศถูกแก้แล้วส่งตรวจใหม่ แล้ว admin ปฏิเสธภายหลัง แถว offer ยังชี้มาที่ประกาศเดิม
    await prisma.listing.updateMany({
      where: { id: { in: [target.id, myCard.id] } },
      data: { status: 'REJECTED', rejectReason: 'เหตุผลภายใน', reviewedAt: new Date() },
    })

    const views = [await ctx.buyer.get('/api/offers/outgoing'), await ctx.seller.get('/api/offers/incoming')]
    for (const { body } of views) {
      const [row] = body.offers
      expect(row.listing).not.toHaveProperty('rejectReason')
      expect(row.listing).not.toHaveProperty('reviewedAt')
      expect(row.items[0].listing).not.toHaveProperty('rejectReason')
      expect(JSON.stringify(body)).not.toContain('เหตุผลภายใน')
    }
  })
})

describe('ปิดประกาศ', () => {
  it('ยกเลิก offer ที่ค้างอยู่กับประกาศนั้น', async () => {
    const listing = await createListing(ctx.sellerId)
    const { body } = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    expect((await ctx.seller.post(`/api/listings/${listing.id}/close`)).body.listing.status).toBe('CLOSED')
    expect((await prisma.offer.findUnique({ where: { id: body.offer.id } }))?.status).toBe('CANCELLED')
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { createListing, signedInUser, type Agent } from './helpers.js'

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

describe('ปิดประกาศ', () => {
  it('ยกเลิก offer ที่ค้างอยู่กับประกาศนั้น', async () => {
    const listing = await createListing(ctx.sellerId)
    const { body } = await offer(ctx.buyer, { listingId: listing.id, cashAmount: 10 })
    expect((await ctx.seller.post(`/api/listings/${listing.id}/close`)).body.listing.status).toBe('CLOSED')
    expect((await prisma.offer.findUnique({ where: { id: body.offer.id } }))?.status).toBe('CANCELLED')
  })
})

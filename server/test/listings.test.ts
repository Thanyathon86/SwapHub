import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { createGame, createListing, signedInUser, type Agent } from './helpers.js'

let seller: Agent
let sellerId: string
let gameId: string

beforeEach(async () => {
  const s = await signedInUser()
  seller = s.agent
  sellerId = s.user.id
  gameId = (await createGame()).id
})

// body เต็มแบบเดียวกับฟอร์ม ใช้ค่าเริ่มต้นเดียวกับ createListing ใน helpers
const singleBody = (overrides: object = {}) => ({
  itemKind: 'SINGLE',
  type: 'SALE',
  gameId,
  title: 'Pikachu',
  setName: 'Base Set',
  language: 'EN',
  condition: 'NM',
  quantity: 1,
  price: 100,
  ...overrides,
})

const edit = (agent: Agent, id: string, body: object) => agent.patch(`/api/listings/${id}`).send(body)

describe('แก้ประกาศที่เปิดอยู่', () => {
  it('แก้ราคา/จำนวน/รายละเอียด -> ยัง ACTIVE และข้อเสนอที่ค้างยังอยู่', async () => {
    const listing = await createListing(sellerId, { gameId })
    const buyer = await signedInUser()
    const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 90 })

    const res = await edit(seller, listing.id, singleBody({ price: 120, quantity: 3, description: 'มีตำหนิมุม' }))
    expect(res.body.listing).toMatchObject({ status: 'ACTIVE', price: '120', quantity: 3, description: 'มีตำหนิมุม' })
    expect((await prisma.offer.findUnique({ where: { id: body.offer.id } }))?.status).toBe('PENDING')
  })

  it('แก้ตัวการ์ด -> กลับไปรอตรวจ และยกเลิกข้อเสนอที่ค้าง', async () => {
    const listing = await createListing(sellerId, { gameId })
    const buyer = await signedInUser()
    const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 90 })

    const res = await edit(seller, listing.id, singleBody({ title: 'Charizard' }))
    expect(res.body.listing.status).toBe('PENDING_REVIEW')
    expect((await prisma.offer.findUnique({ where: { id: body.offer.id } }))?.status).toBe('CANCELLED')
    // ไม่อยู่ในตลาดระหว่างรอตรวจ
    expect((await seller.get(`/api/listings/${listing.id}`)).status).toBe(404)
  })

  it('เปลี่ยนสภาพการ์ดก็นับเป็นการแก้ตัวการ์ด', async () => {
    const listing = await createListing(sellerId, { gameId })
    expect((await edit(seller, listing.id, singleBody({ condition: 'LP' }))).body.listing.status).toBe('PENDING_REVIEW')
  })

  it('เปลี่ยนเป็นแลกอย่างเดียว -> ยกเลิกเฉพาะข้อเสนอที่เป็นเงินอย่างเดียว', async () => {
    const listing = await createListing(sellerId, { gameId, type: 'BOTH' })
    const cash = await signedInUser()
    const trader = await signedInUser()
    const tradeCard = await createListing(trader.user.id, { type: 'TRADE', price: null })
    const cashOffer = await cash.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 90 })
    const tradeOffer = await trader.agent.post('/api/offers').send({ listingId: listing.id, items: [{ listingId: tradeCard.id }] })

    const res = await edit(seller, listing.id, singleBody({ type: 'TRADE', price: undefined }))
    expect(res.body.listing).toMatchObject({ status: 'ACTIVE', type: 'TRADE', price: null })
    expect((await prisma.offer.findUnique({ where: { id: cashOffer.body.offer.id } }))?.status).toBe('CANCELLED')
    expect((await prisma.offer.findUnique({ where: { id: tradeOffer.body.offer.id } }))?.status).toBe('PENDING')
  })

  it('ลบฟิลด์ไม่บังคับออก -> เป็น null จริง', async () => {
    const listing = await createListing(sellerId, { gameId, description: 'เดิม', rarity: 'SAR' })
    const res = await edit(seller, listing.id, singleBody({ rarity: 'SAR', description: '' }))
    expect(res.body.listing).toMatchObject({ description: null, rarity: 'SAR', status: 'ACTIVE' })
  })
})

describe('สถานะอื่นและสิทธิ์', () => {
  it('ประกาศที่ไม่ผ่าน แก้แล้วส่งตรวจใหม่ และล้างเหตุผลเดิม', async () => {
    const listing = await createListing(sellerId, { gameId, status: 'REJECTED', rejectReason: 'รูปไม่ชัด' })
    const res = await edit(seller, listing.id, singleBody({ price: 110 }))
    expect(res.body.listing).toMatchObject({ status: 'PENDING_REVIEW', rejectReason: null })
  })

  it('ประกาศที่รอตรวจ แก้แล้วยังรอตรวจ', async () => {
    const listing = await createListing(sellerId, { gameId, status: 'PENDING_REVIEW' })
    expect((await edit(seller, listing.id, singleBody({ title: 'Raichu' }))).body.listing.status).toBe('PENDING_REVIEW')
  })

  it('ประกาศที่ปิดแล้วแก้ไม่ได้', async () => {
    const listing = await createListing(sellerId, { gameId, status: 'CLOSED' })
    expect((await edit(seller, listing.id, singleBody())).body.error.code).toBe('LISTING_NOT_EDITABLE')
  })

  it('เปลี่ยนประเภทสินค้าไม่ได้', async () => {
    const listing = await createListing(sellerId, { gameId })
    const res = await edit(seller, listing.id, { itemKind: 'SEALED', type: 'SALE', gameId, title: 'Box', setName: 'S', language: 'EN', quantity: 1, price: 10 })
    expect(res.body.error.code).toBe('ITEM_KIND_IMMUTABLE')
  })

  it('แก้ประกาศของคนอื่นไม่ได้ (404)', async () => {
    const other = await signedInUser()
    const listing = await createListing(sellerId, { gameId })
    expect((await edit(other.agent, listing.id, singleBody({ price: 1 }))).status).toBe(404)
    expect((await other.agent.get(`/api/listings/mine/${listing.id}`)).status).toBe(404)
  })

  it('เกมที่ถูกปิดใช้ไม่ได้', async () => {
    const listing = await createListing(sellerId, { gameId })
    const closedGame = await createGame({ isActive: false })
    expect((await edit(seller, listing.id, singleBody({ gameId: closedGame.id }))).body.error.code).toBe('INVALID_GAME')
  })

  it('GET /api/listings/mine/:id ดูประกาศของตัวเองได้ทุกสถานะ', async () => {
    const listing = await createListing(sellerId, { gameId, status: 'REJECTED' })
    expect((await seller.get(`/api/listings/mine/${listing.id}`)).body.listing.id).toBe(listing.id)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { createListing, signedInUser, type Agent } from './helpers.js'

type Party = { agent: Agent; id: string }
let seller: Party
let buyer: Party

const party = async (): Promise<Party> => {
  const { user, agent } = await signedInUser()
  return { agent, id: user.id }
}

const pendingOffer = async () => {
  const listing = await createListing(seller.id, { quantity: 5 })
  const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
  return body.offer.id as string
}

const send = (agent: Agent, offerId: string, body: string) => agent.post(`/api/offers/${offerId}/messages`).send({ body })
const read = (agent: Agent, offerId: string) => agent.get(`/api/offers/${offerId}/messages`)

beforeEach(async () => {
  seller = await party()
  buyer = await party()
})

describe('แชทในข้อเสนอ', () => {
  it('ทั้งสองฝ่ายคุยกันได้ ข้อความเรียงเก่าไปใหม่', async () => {
    const offerId = await pendingOffer()
    expect((await send(buyer.agent, offerId, 'ยังมีของไหมครับ')).status).toBe(201)
    expect((await send(seller.agent, offerId, '  มีครับ  ')).status).toBe(201)

    const res = await read(seller.agent, offerId)
    expect(res.body.canSend).toBe(true)
    expect(res.body.messages.map((m: { authorId: string; body: string }) => [m.authorId, m.body])).toEqual([
      [buyer.id, 'ยังมีของไหมครับ'],
      [seller.id, 'มีครับ'],
    ])
  })

  it('คนนอกดีลอ่านหรือส่งไม่ได้ (404)', async () => {
    const offerId = await pendingOffer()
    const stranger = await party()
    expect((await read(stranger.agent, offerId)).body.error.code).toBe('OFFER_NOT_FOUND')
    expect((await send(stranger.agent, offerId, 'แอบดู')).body.error.code).toBe('OFFER_NOT_FOUND')
    expect(await prisma.offerMessage.count()).toBe(0)
  })

  it('หลังตอบรับยังคุยนัดส่งของต่อได้', async () => {
    const offerId = await pendingOffer()
    await seller.agent.post(`/api/offers/${offerId}/accept`)
    expect((await send(buyer.agent, offerId, 'โอนแล้วครับ')).status).toBe(201)
  })

  it('ดีลที่ปฏิเสธหรือยกเลิกแล้วอ่านได้อย่างเดียว', async () => {
    const declined = await pendingOffer()
    await send(buyer.agent, declined, 'ลดได้ไหม')
    await seller.agent.post(`/api/offers/${declined}/decline`)
    expect((await send(buyer.agent, declined, 'ลดอีกนิด')).body.error.code).toBe('OFFER_CHAT_CLOSED')
    const res = await read(buyer.agent, declined)
    expect(res.body).toMatchObject({ canSend: false, messages: [{ body: 'ลดได้ไหม' }] })

    const cancelled = await pendingOffer()
    await buyer.agent.post(`/api/offers/${cancelled}/cancel`)
    expect((await send(seller.agent, cancelled, 'ยังอยู่ไหม')).body.error.code).toBe('OFFER_CHAT_CLOSED')
  })

  it('ข้อความต้องไม่ว่างและไม่เกิน 2000 ตัวอักษร', async () => {
    const offerId = await pendingOffer()
    expect((await send(buyer.agent, offerId, '   ')).body.error.code).toBe('VALIDATION_ERROR')
    expect((await send(buyer.agent, offerId, 'x'.repeat(2001))).body.error.code).toBe('VALIDATION_ERROR')
  })

  it('รายการข้อเสนอบอกจำนวนข้อความ', async () => {
    const offerId = await pendingOffer()
    await send(buyer.agent, offerId, 'สวัสดี')
    await send(seller.agent, offerId, 'ครับ')
    const { body } = await seller.agent.get('/api/offers/incoming')
    expect(body.offers[0]._count).toEqual({ messages: 2 })
  })

  it('ต้องล็อกอิน', async () => {
    const offerId = await pendingOffer()
    await buyer.agent.post('/api/auth/logout')
    expect((await read(buyer.agent, offerId)).status).toBe(401)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import { processEscrowDeadlines } from '../src/modules/escrow/escrow.service.js'
import { prisma } from '../src/lib/prisma.js'
import { createListing, signedInAdmin, signedInUser, type Agent } from './helpers.js'

type Party = { agent: Agent; id: string }

let seller: Party
let buyer: Party

const party = async (): Promise<Party> => {
  const { user, agent } = await signedInUser()
  return { agent, id: user.id }
}

const tracking = { carrier: 'Thailand Post', trackingNumber: 'EX123' }

const post = (who: Party, id: string, action: string, body?: object) => who.agent.post(`/api/escrow/${id}/${action}`).send(body)

const statusOf = async (id: string) => (await prisma.escrow.findUniqueOrThrow({ where: { id } })).status
const listingOf = (id: string) => prisma.listing.findUniqueOrThrow({ where: { id } })
const offerOf = (id: string) => prisma.offer.findUniqueOrThrow({ where: { id } })

// ดีลเงินล้วน ตอบรับแล้ว คืน id ของ escrow, offer, listing
const cashDeal = async (quantity = 1, cashAmount = 150.5) => {
  const listing = await createListing(seller.id, { quantity })
  const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount })
  const res = await seller.agent.post(`/api/offers/${body.offer.id}/accept`)
  return { id: res.body.offer.escrow.id as string, offerId: body.offer.id as string, listingId: listing.id }
}

// ดีลเงินบวกการ์ดแลก ทั้งสองฝ่ายต้องส่งของ
const mixedDeal = async () => {
  const listing = await createListing(seller.id, { type: 'BOTH' })
  const myCard = await createListing(buyer.id, { type: 'TRADE', price: null })
  const { body } = await buyer.agent
    .post('/api/offers')
    .send({ listingId: listing.id, cashAmount: 100, items: [{ listingId: myCard.id }] })
  const res = await seller.agent.post(`/api/offers/${body.offer.id}/accept`)
  return { id: res.body.offer.escrow.id as string, offerId: body.offer.id as string, listingId: listing.id, itemId: myCard.id }
}

// ตั้งกำหนดเวลาให้เลยไปแล้ว แทนการรอเวลาจริง
const expireDeadlines = (id: string) => {
  const past = new Date(Date.now() - 1000)
  return prisma.escrow.update({ where: { id }, data: { paymentDueAt: past, shipDueAt: past, confirmDueAt: past } })
}

beforeEach(async () => {
  seller = await party()
  buyer = await party()
})

describe('สร้าง escrow ตอนตอบรับ', () => {
  it('ดีลมีเงินได้ escrow ที่ล็อกยอดและเริ่มรอจ่าย', async () => {
    const { id } = await cashDeal()
    expect(await prisma.escrow.findUnique({ where: { id } })).toMatchObject({
      status: 'AWAITING_PAYMENT',
      buyerId: buyer.id,
      sellerId: seller.id,
      twoWay: false,
    })
    expect(String((await prisma.escrow.findUniqueOrThrow({ where: { id } })).amount)).toBe('150.5')
  })

  it('การแลกล้วนไม่มี escrow', async () => {
    const listing = await createListing(seller.id, { type: 'TRADE', price: null })
    const myCard = await createListing(buyer.id, { type: 'TRADE', price: null })
    const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, items: [{ listingId: myCard.id }] })
    const res = await seller.agent.post(`/api/offers/${body.offer.id}/accept`)
    expect(res.body.offer.escrow).toBeNull()
    expect(res.body.offer.buyer.email).toMatch(/@test\.local$/)
    expect(await prisma.escrow.count()).toBe(0)
  })

  it('ดีลเงินบวกการ์ดเป็นแบบสองฝั่ง', async () => {
    const { id } = await mixedDeal()
    expect((await prisma.escrow.findUniqueOrThrow({ where: { id } })).twoWay).toBe(true)
  })
})

describe('เส้นปกติ', () => {
  it('จ่าย ส่ง ยืนยันรับ แล้วเงินถึงผู้ขาย พร้อมประวัติครบทุกขั้น', async () => {
    const { id } = await cashDeal()
    expect((await post(buyer, id, 'pay')).body.escrow.status).toBe('HELD')
    expect((await post(seller, id, 'ship', tracking)).body.escrow).toMatchObject({ status: 'SHIPPED', sellerTrackingNumber: 'EX123' })
    expect((await post(buyer, id, 'confirm')).body.escrow.status).toBe('RELEASED')

    const row = await prisma.escrow.findUniqueOrThrow({ where: { id }, include: { events: { orderBy: { createdAt: 'asc' } } } })
    expect(row.events.map((e) => e.type)).toEqual(['CREATED', 'PAID', 'SHIPPED', 'RECEIVED', 'RELEASED'])
    expect(row.paymentRef).toMatch(/^mock_charge_/)
    expect(row.payoutRef).toMatch(/^mock_payout_/)
    expect(row.refundRef).toBeNull()
    expect(row.settledAt).not.toBeNull()
  })

  it('อีเมลเปิดหลังจ่าย และรีวิวได้หลังเงินจบเท่านั้น', async () => {
    const { id, offerId } = await cashDeal()
    const emailOf = async () =>
      (await buyer.agent.get('/api/offers/outgoing')).body.offers[0].listing.seller.email as string | null
    const review = () => buyer.agent.put(`/api/offers/${offerId}/review`).send({ rating: 5 })

    expect(await emailOf()).toBeNull()
    expect((await review()).body.error.code).toBe('ESCROW_NOT_SETTLED')

    await post(buyer, id, 'pay')
    expect(await emailOf()).toMatch(/@test\.local$/)
    expect((await review()).body.error.code).toBe('ESCROW_NOT_SETTLED')

    await post(seller, id, 'ship', tracking)
    await post(buyer, id, 'confirm')
    expect((await review()).status).toBe(200)
  })

  it('ไม่ส่งข้อมูลทีมงานหรือเลขอ้างอิงการเงินให้ผู้ใช้', async () => {
    const { id } = await cashDeal()
    await post(buyer, id, 'pay')
    const { body } = await post(buyer, id, 'dispute', { reason: 'ของไม่มา' })
    const admin = await signedInAdmin()
    await admin.agent.post(`/api/admin/escrows/${id}/resolve`).send({ decision: 'REFUND', reason: 'ผู้ขายไม่ส่ง' }).expect(200)

    const { offers } = (await buyer.agent.get('/api/offers/outgoing')).body
    const view = offers[0].escrow
    for (const key of ['paymentRef', 'payoutRef', 'refundRef', 'resolvedById', 'disputedById']) {
      expect(view).not.toHaveProperty(key)
      expect(body.escrow).not.toHaveProperty(key)
    }
    expect(JSON.stringify(view)).not.toContain(admin.user.id)
    expect(view.events.at(-1)).toMatchObject({ type: 'REFUNDED', actor: 'STAFF', note: 'ผู้ขายไม่ส่ง' })
  })
})

describe('สิทธิ์และลำดับขั้น', () => {
  it('คนนอกดีลได้ 404 ทุกการกระทำ', async () => {
    const { id } = await cashDeal()
    const stranger = await party()
    for (const action of ['pay', 'confirm', 'cancel']) {
      expect((await post(stranger, id, action)).status).toBe(404)
    }
    expect((await post(stranger, id, 'ship', tracking)).status).toBe(404)
    expect((await post(stranger, id, 'dispute', { reason: 'x' })).status).toBe(404)
    expect(await statusOf(id)).toBe('AWAITING_PAYMENT')
  })

  it('ผู้ขายจ่ายแทนไม่ได้ ผู้ซื้อแจ้งส่งดีลเงินล้วนไม่ได้ ผู้ขายยืนยันรับแทนไม่ได้', async () => {
    const { id } = await cashDeal()
    expect((await post(seller, id, 'pay')).body.error.code).toBe('ESCROW_WRONG_PARTY')
    await post(buyer, id, 'pay')
    expect((await post(buyer, id, 'ship', tracking)).body.error.code).toBe('ESCROW_WRONG_PARTY')
    await post(seller, id, 'ship', tracking)
    expect((await post(seller, id, 'confirm')).body.error.code).toBe('ESCROW_WRONG_PARTY')
    expect(await statusOf(id)).toBe('SHIPPED')
  })

  it('ข้ามขั้นไม่ได้ และทำซ้ำไม่ได้', async () => {
    const { id } = await cashDeal()
    expect((await post(seller, id, 'ship', tracking)).body.error.code).toBe('ESCROW_INVALID_STATE')
    expect((await post(buyer, id, 'confirm')).body.error.code).toBe('ESCROW_INVALID_STATE')
    expect((await post(buyer, id, 'dispute', { reason: 'x' })).body.error.code).toBe('ESCROW_INVALID_STATE')
    await post(buyer, id, 'pay')
    expect((await post(buyer, id, 'pay')).body.error.code).toBe('ESCROW_INVALID_STATE')
    expect(await prisma.escrowEvent.count({ where: { escrowId: id, type: 'PAID' } })).toBe(1)
  })

  it('กดจ่ายพร้อมกันสำเร็จครั้งเดียว', async () => {
    const { id } = await cashDeal()
    const results = await Promise.all([post(buyer, id, 'pay'), post(buyer, id, 'pay'), post(buyer, id, 'pay')])
    expect(results.filter((r) => r.status === 200)).toHaveLength(1)
    expect(await prisma.escrowEvent.count({ where: { escrowId: id, type: 'PAID' } })).toBe(1)
  })

  it('ต้องกรอกเลขพัสดุและเหตุผลข้อพิพาท', async () => {
    const { id } = await cashDeal()
    await post(buyer, id, 'pay')
    expect((await post(seller, id, 'ship', { carrier: 'x' })).status).toBe(400)
    expect((await post(buyer, id, 'dispute', { reason: '  ' })).status).toBe(400)
  })
})

describe('ยกเลิก', () => {
  it('ก่อนจ่ายยกเลิกได้ทั้งสองฝ่าย คืนสต็อก เปิดประกาศกลับ และปิดแชท', async () => {
    const { id, offerId, listingId } = await cashDeal()
    expect(await listingOf(listingId)).toMatchObject({ quantity: 0, status: 'CLOSED' })
    expect((await post(buyer, id, 'cancel')).body.escrow.status).toBe('CANCELLED')
    expect(await listingOf(listingId)).toMatchObject({ quantity: 1, status: 'ACTIVE' })
    expect((await offerOf(offerId)).status).toBe('CANCELLED')
    const chat = await buyer.agent.post(`/api/offers/${offerId}/messages`).send({ body: 'ยังอยู่ไหม' })
    expect(chat.body.error.code).toBe('OFFER_CHAT_CLOSED')
  })

  it('จ่ายแล้วผู้ซื้อยกเลิกเองไม่ได้ แต่ผู้ขายยกเลิกก่อนส่งของแล้วคืนเงินได้', async () => {
    const { id, listingId } = await cashDeal()
    await post(buyer, id, 'pay')
    expect((await post(buyer, id, 'cancel')).body.error.code).toBe('ESCROW_WRONG_PARTY')
    expect((await post(seller, id, 'cancel')).body.escrow.status).toBe('REFUNDED')
    expect((await prisma.escrow.findUniqueOrThrow({ where: { id } })).refundRef).toMatch(/^mock_refund_/)
    expect(await listingOf(listingId)).toMatchObject({ quantity: 1, status: 'ACTIVE' })
  })

  it('ส่งของแล้วยกเลิกไม่ได้', async () => {
    const { id } = await cashDeal()
    await post(buyer, id, 'pay')
    await post(seller, id, 'ship', tracking)
    expect((await post(seller, id, 'cancel')).body.error.code).toBe('ESCROW_INVALID_STATE')
  })

  it('ประกาศที่เจ้าของปิดเองไม่ถูกเปิดกลับตอนคืนสต็อก', async () => {
    const { id, listingId } = await cashDeal(3)
    await seller.agent.post(`/api/listings/${listingId}/close`)
    await post(seller, id, 'cancel')
    expect(await listingOf(listingId)).toMatchObject({ quantity: 3, status: 'CLOSED' })
  })
})

describe('ดีลสองฝั่ง', () => {
  it('ต้องส่งครบและยืนยันรับครบทั้งสองฝ่ายก่อนปล่อยเงิน', async () => {
    const { id } = await mixedDeal()
    await post(buyer, id, 'pay')
    expect((await post(seller, id, 'ship', tracking)).body.escrow.status).toBe('HELD')
    expect((await post(seller, id, 'ship', tracking)).body.error.code).toBe('ESCROW_INVALID_STATE')
    expect((await post(buyer, id, 'ship', { ...tracking, trackingNumber: 'EX999' })).body.escrow).toMatchObject({
      status: 'SHIPPED',
      buyerTrackingNumber: 'EX999',
    })
    expect((await post(buyer, id, 'confirm')).body.escrow.status).toBe('SHIPPED')
    expect((await post(seller, id, 'confirm')).body.escrow.status).toBe('RELEASED')
  })

  it('สองฝ่ายแจ้งส่งพร้อมกันแล้วไม่ค้าง', async () => {
    const { id } = await mixedDeal()
    await post(buyer, id, 'pay')
    await Promise.all([post(seller, id, 'ship', tracking), post(buyer, id, 'ship', tracking)])
    expect(await statusOf(id)).toBe('SHIPPED')
  })

  it('เลยกำหนดและส่งฝั่งเดียว ไม่คืนเงินอัตโนมัติแต่ส่งให้ทีมงานตัดสิน', async () => {
    const { id } = await mixedDeal()
    await post(buyer, id, 'pay')
    await post(seller, id, 'ship', tracking)
    await expireDeadlines(id)
    await processEscrowDeadlines()
    expect(await statusOf(id)).toBe('DISPUTED')
  })

  it('คืนเงินเมื่อส่งฝั่งเดียว คืนสต็อกเฉพาะฝั่งที่ยังไม่ส่ง และดีลยังรีวิวกันได้', async () => {
    const { id, offerId, listingId, itemId } = await mixedDeal()
    await post(buyer, id, 'pay')
    await post(seller, id, 'ship', tracking)
    await post(buyer, id, 'dispute', { reason: 'เปลี่ยนใจ' })
    const admin = await signedInAdmin()
    await admin.agent.post(`/api/admin/escrows/${id}/resolve`).send({ decision: 'REFUND', reason: 'ตกลงกันได้' }).expect(200)
    expect((await listingOf(listingId)).quantity).toBe(0)
    expect((await listingOf(itemId)).quantity).toBe(1)
    expect((await offerOf(offerId)).status).toBe('ACCEPTED')
  })
})

describe('กำหนดเวลา', () => {
  it('ไม่จ่ายตามกำหนด: จ่ายไม่ได้แล้ว และงานกวาดปิดพร้อมคืนสต็อก', async () => {
    const { id, offerId, listingId } = await cashDeal()
    await expireDeadlines(id)
    expect((await post(buyer, id, 'pay')).body.error.code).toBe('ESCROW_PAYMENT_EXPIRED')
    await processEscrowDeadlines()
    expect(await statusOf(id)).toBe('EXPIRED')
    expect((await offerOf(offerId)).status).toBe('CANCELLED')
    expect(await listingOf(listingId)).toMatchObject({ quantity: 1, status: 'ACTIVE' })
  })

  it('ไม่ส่งของตามกำหนด: คืนเงินผู้ซื้อ', async () => {
    const { id, listingId } = await cashDeal()
    await post(buyer, id, 'pay')
    await expireDeadlines(id)
    await processEscrowDeadlines()
    expect(await statusOf(id)).toBe('REFUNDED')
    expect((await listingOf(listingId)).quantity).toBe(1)
  })

  it('ไม่ยืนยันรับตามกำหนด: ปล่อยเงินให้ผู้ขาย และบันทึกว่าระบบเป็นคนทำ', async () => {
    const { id } = await cashDeal()
    await post(buyer, id, 'pay')
    await post(seller, id, 'ship', tracking)
    await expireDeadlines(id)
    await processEscrowDeadlines()
    expect(await statusOf(id)).toBe('RELEASED')
    const last = await prisma.escrowEvent.findFirstOrThrow({ where: { escrowId: id, type: 'RELEASED' } })
    expect(last.actorId).toBeNull()
  })

  it('ยังไม่ถึงกำหนดไม่แตะ และข้อพิพาทไม่ถูกปล่อยเงินเอง', async () => {
    const waiting = await cashDeal()
    await processEscrowDeadlines()
    expect(await statusOf(waiting.id)).toBe('AWAITING_PAYMENT')

    const disputed = await cashDeal()
    await post(buyer, disputed.id, 'pay')
    await post(buyer, disputed.id, 'dispute', { reason: 'ติดต่อไม่ได้' })
    await expireDeadlines(disputed.id)
    await processEscrowDeadlines()
    expect(await statusOf(disputed.id)).toBe('DISPUTED')
  })
})

describe('ข้อพิพาทและหลังบ้าน', () => {
  const disputedDeal = async () => {
    const deal = await cashDeal()
    await post(buyer, deal.id, 'pay')
    await post(seller, deal.id, 'ship', tracking)
    await post(buyer, deal.id, 'dispute', { reason: 'การ์ดไม่ตรงปก' })
    return deal
  }

  it('ระหว่างมีข้อพิพาทยืนยันรับไม่ได้', async () => {
    const { id } = await disputedDeal()
    expect((await post(buyer, id, 'confirm')).body.error.code).toBe('ESCROW_INVALID_STATE')
  })

  it('admin ปล่อยเงิน: ต้องมีเหตุผล ลง audit โดย target คือผู้ขาย', async () => {
    const { id } = await disputedDeal()
    const admin = await signedInAdmin()
    const resolve = (body: object) => admin.agent.post(`/api/admin/escrows/${id}/resolve`).send(body)
    expect((await resolve({ decision: 'RELEASE' })).status).toBe(400)
    const res = await resolve({ decision: 'RELEASE', reason: 'ตรวจรูปแล้วตรงปก' })
    expect(res.body.escrow).toMatchObject({ status: 'RELEASED', resolutionNote: 'ตรวจรูปแล้วตรงปก', resolvedBy: { id: admin.user.id } })
    const log = await prisma.auditLog.findFirstOrThrow({ where: { action: 'ESCROW_RELEASED' } })
    expect(log).toMatchObject({ actorId: admin.user.id, targetUserId: seller.id })
    expect(log.detail).toContain('ตรวจรูปแล้วตรงปก')
  })

  it('admin คืนเงินหลังส่งของ: ไม่คืนสต็อก ดีลยังรีวิวกันได้ target คือผู้ซื้อ', async () => {
    const { id, offerId, listingId } = await disputedDeal()
    const admin = await signedInAdmin()
    await admin.agent.post(`/api/admin/escrows/${id}/resolve`).send({ decision: 'REFUND', reason: 'ของปลอม' }).expect(200)
    expect((await listingOf(listingId)).quantity).toBe(0)
    expect((await offerOf(offerId)).status).toBe('ACCEPTED')
    expect((await prisma.auditLog.findFirstOrThrow({ where: { action: 'ESCROW_REFUNDED' } })).targetUserId).toBe(buyer.id)
    expect((await buyer.agent.put(`/api/offers/${offerId}/review`).send({ rating: 1 })).status).toBe(200)
  })

  it('ตัดสินซ้ำไม่ได้ และเคสที่ยังไม่จ่ายตัดสินไม่ได้', async () => {
    const { id } = await disputedDeal()
    const admin = await signedInAdmin()
    const resolve = (target: string) =>
      admin.agent.post(`/api/admin/escrows/${target}/resolve`).send({ decision: 'REFUND', reason: 'x' })
    await resolve(id).expect(200)
    expect((await resolve(id)).body.error.code).toBe('ESCROW_INVALID_STATE')
    expect(await prisma.auditLog.count({ where: { action: 'ESCROW_REFUNDED' } })).toBe(1)
    const unpaid = await cashDeal()
    expect((await resolve(unpaid.id)).body.error.code).toBe('ESCROW_INVALID_STATE')
  })

  it('admin ที่เป็นคู่ดีลเองตัดสินไม่ได้', async () => {
    const { id } = await disputedDeal()
    const insider = await signedInAdmin()
    await prisma.escrow.update({ where: { id }, data: { buyerId: insider.user.id } })
    const res = await insider.agent.post(`/api/admin/escrows/${id}/resolve`).send({ decision: 'REFUND', reason: 'x' })
    expect(res.body.error.code).toBe('ESCROW_SELF_RESOLVE')
    expect(await statusOf(id)).toBe('DISPUTED')
  })

  it('ผู้ใช้ทั่วไปเรียก API หลังบ้านไม่ได้', async () => {
    const { id } = await disputedDeal()
    expect((await buyer.agent.get('/api/admin/escrows')).status).toBe(403)
    expect((await buyer.agent.get(`/api/admin/escrows/${id}`)).status).toBe(403)
    const res = await buyer.agent.post(`/api/admin/escrows/${id}/resolve`).send({ decision: 'REFUND', reason: 'x' })
    expect(res.status).toBe(403)
    expect(await statusOf(id)).toBe('DISPUTED')
  })

  it('ทีมงานอ่านแชทได้เฉพาะดีลที่มีข้อพิพาท', async () => {
    const quiet = await cashDeal()
    await buyer.agent.post(`/api/offers/${quiet.offerId}/messages`).send({ body: 'ส่วนตัว' })
    const admin = await signedInAdmin()
    expect((await admin.agent.get(`/api/admin/escrows/${quiet.id}`)).body.escrow.messages).toEqual([])

    await post(buyer, quiet.id, 'pay')
    await post(buyer, quiet.id, 'dispute', { reason: 'x' })
    expect((await admin.agent.get(`/api/admin/escrows/${quiet.id}`)).body.escrow.messages).toMatchObject([{ body: 'ส่วนตัว' }])
  })

  it('รายการกรองตามสถานะ รวมยอดที่ถือไว้ และนับบนเมนู', async () => {
    const { id } = await disputedDeal()
    const held = await cashDeal(1, 49.5)
    await post(buyer, held.id, 'pay')
    await cashDeal()
    const admin = await signedInAdmin()
    const { body } = await admin.agent.get('/api/admin/escrows?status=DISPUTED')
    expect(body.escrows.map((e: { id: string }) => e.id)).toEqual([id])
    expect(body.holding.count).toBe(2)
    expect(Number(body.holding.amount)).toBe(200)
    expect((await admin.agent.get('/api/admin/counts')).body.openDisputes).toBe(1)
    expect((await admin.agent.get('/api/admin/dashboard')).body.attention.openDisputes).toBe(1)
  })
})

describe('ระงับบัญชี', () => {
  const suspend = async (userId: string) => {
    const admin = await signedInAdmin()
    await admin.agent.patch(`/api/admin/users/${userId}/status`).send({ status: 'SUSPENDED' }).expect(200)
  }

  it('ยังไม่จ่าย: ยกเลิกและคืนสต็อก', async () => {
    const { id, listingId } = await cashDeal()
    await suspend(buyer.id)
    expect(await statusOf(id)).toBe('CANCELLED')
    expect((await listingOf(listingId)).quantity).toBe(1)
  })

  it('จ่ายแล้วยังไม่ส่ง: คืนเงินผู้ซื้อ', async () => {
    const { id } = await cashDeal()
    await post(buyer, id, 'pay')
    await suspend(seller.id)
    expect(await statusOf(id)).toBe('REFUNDED')
  })

  it('ส่งแล้ว: เป็นข้อพิพาท ไม่ปล่อยเงินอัตโนมัติ และไม่บอกอีกฝ่ายว่าใครถูกระงับ', async () => {
    const { id } = await cashDeal()
    await post(buyer, id, 'pay')
    await post(seller, id, 'ship', tracking)
    await suspend(seller.id)
    expect(await statusOf(id)).toBe('DISPUTED')
    await expireDeadlines(id)
    await processEscrowDeadlines()
    expect(await statusOf(id)).toBe('DISPUTED')
    const view = (await buyer.agent.get('/api/offers/outgoing')).body.offers[0].escrow
    expect(view.events.at(-1).actor).toBe('STAFF')
    expect(view.disputeReason).not.toContain(seller.id)
  })
})

describe('ตัวเลขงานค้างของผู้ใช้', () => {
  const countOf = async (who: Party) => (await who.agent.get('/api/me/counts')).body.escrowActions as number

  it('นับเฉพาะฝ่ายที่ต้องทำขั้นต่อไป', async () => {
    const { id } = await cashDeal()
    expect([await countOf(buyer), await countOf(seller)]).toEqual([1, 0])
    await post(buyer, id, 'pay')
    expect([await countOf(buyer), await countOf(seller)]).toEqual([0, 1])
    await post(seller, id, 'ship', tracking)
    expect([await countOf(buyer), await countOf(seller)]).toEqual([1, 0])
    await post(buyer, id, 'confirm')
    expect([await countOf(buyer), await countOf(seller)]).toEqual([0, 0])
  })
})

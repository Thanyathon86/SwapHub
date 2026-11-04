import { existsSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { env } from '../src/config/env.js'
import { prisma } from '../src/lib/prisma.js'
import { uploadRoot } from '../src/lib/storage.js'
import { createListing, createUser, PASSWORD, signedInAdmin, signedInUser, userAgent, type Agent } from './helpers.js'

type Party = { agent: Agent; id: string; email: string }

let seller: Party
let buyer: Party

const party = async (): Promise<Party> => {
  const { user, agent } = await signedInUser()
  return { agent, id: user.id, email: user.email }
}

const open = (who: Party, body: object) => who.agent.post('/api/chat/conversations').send(body)
const send = (who: Party, id: string, body: string) => who.agent.post(`/api/chat/conversations/${id}/messages`).send({ body })
const read = (who: Party, id: string) => who.agent.post(`/api/chat/conversations/${id}/read`)
const inbox = async (who: Party) => (await who.agent.get('/api/chat/conversations')).body.conversations
const unreadOf = async (who: Party) => (await who.agent.get('/api/me/counts')).body.unreadMessages as number

const room = async (who = buyer) => {
  const listing = await createListing(seller.id, { quantity: 5 })
  const res = await open(who, { listingId: listing.id })
  return { id: res.body.conversation.id as string, listingId: listing.id }
}

const png = () => sharp({ create: { width: 40, height: 30, channels: 3, background: '#e60012' } }).png().toBuffer()
const upload = async (who: Party, id: string) =>
  who.agent.post(`/api/chat/conversations/${id}/images`).attach('image', await png(), 'card.png')

beforeEach(async () => {
  seller = await party()
  buyer = await party()
})

describe('เปิดห้อง', () => {
  it('หนึ่งห้องต่อหนึ่งประกาศต่อผู้ซื้อ กดซ้ำหรือกดพร้อมกันได้ห้องเดิม', async () => {
    const listing = await createListing(seller.id)
    const results = await Promise.all([open(buyer, { listingId: listing.id }), open(buyer, { listingId: listing.id })])
    expect(results.every((r) => r.status === 200)).toBe(true)
    expect(results[0]!.body.conversation.id).toBe(results[1]!.body.conversation.id)
    expect(results[0]!.body.conversation).toMatchObject({ role: 'BUYER', canSend: true, other: { id: seller.id } })
    expect(await prisma.conversation.count()).toBe(1)
  })

  it('คุยกับประกาศของตัวเองไม่ได้ และประกาศที่ไม่อยู่ในตลาดเปิดห้องใหม่ไม่ได้', async () => {
    const mine = await createListing(seller.id)
    expect((await open(seller, { listingId: mine.id })).body.error.code).toBe('CHAT_OWN_LISTING')
    const pending = await createListing(seller.id, { status: 'PENDING_REVIEW' })
    expect((await open(buyer, { listingId: pending.id })).body.error.code).toBe('LISTING_NOT_FOUND')
  })

  it('ห้องเดิมเปิดต่อได้แม้ประกาศปิดแล้ว', async () => {
    const { id, listingId } = await room()
    await prisma.listing.update({ where: { id: listingId }, data: { status: 'CLOSED' } })
    expect((await open(buyer, { listingId })).body.conversation.id).toBe(id)
  })

  it('เปิดจากข้อเสนอได้ทั้งสองฝ่าย ได้ห้องเดียวกัน และคนนอกเปิดไม่ได้', async () => {
    const listing = await createListing(seller.id, { quantity: 5 })
    const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
    const fromSeller = await open(seller, { offerId: body.offer.id })
    const fromBuyer = await open(buyer, { offerId: body.offer.id })
    expect(fromSeller.body.conversation).toMatchObject({ id: fromBuyer.body.conversation.id, role: 'SELLER' })
    expect(fromBuyer.body.conversation.latestOffer).toMatchObject({ id: body.offer.id, status: 'PENDING' })
    expect((await open(await party(), { offerId: body.offer.id })).status).toBe(404)
  })

  it('รับ listingId กับ offerId พร้อมกันไม่ได้', async () => {
    const { listingId } = await room()
    const res = await open(buyer, { listingId, offerId: listingId })
    expect(res.status).toBe(400)
  })
})

describe('ข้อความ', () => {
  it('ส่งหากันได้ เรียงเก่าไปใหม่ และตัดช่องว่าง', async () => {
    const { id } = await room()
    expect((await send(buyer, id, 'ยังมีของไหมครับ')).status).toBe(201)
    expect((await send(seller, id, '  มีครับ  ')).status).toBe(201)
    const { body } = await seller.agent.get(`/api/chat/conversations/${id}/messages`)
    expect(body.messages.map((m: { authorId: string; body: string }) => [m.authorId, m.body])).toEqual([
      [buyer.id, 'ยังมีของไหมครับ'],
      [seller.id, 'มีครับ'],
    ])
    expect(body.hasMore).toBe(false)
  })

  it('ข้อความว่างหรือยาวเกินส่งไม่ได้', async () => {
    const { id } = await room()
    expect((await send(buyer, id, '   ')).status).toBe(400)
    expect((await send(buyer, id, 'x'.repeat(2001))).status).toBe(400)
  })

  it('คนนอกห้องได้ 404 ทุกเส้น', async () => {
    const { id } = await room()
    const m = await send(buyer, id, 'ส่วนตัว')
    const stranger = await party()
    const base = `/api/chat/conversations/${id}`
    expect((await stranger.agent.get(base)).status).toBe(404)
    expect((await stranger.agent.get(`${base}/messages`)).status).toBe(404)
    expect((await send(stranger, id, 'แอบเข้า')).status).toBe(404)
    expect((await read(stranger, id)).status).toBe(404)
    expect((await stranger.agent.put(`${base}/block`)).status).toBe(404)
    expect((await stranger.agent.get(`/api/chat/images/${m.body.message.id}`)).status).toBe(404)
    expect(await prisma.chatMessage.count()).toBe(1)
  })

  it('ต้องล็อกอิน', async () => {
    expect((await userAgent().get('/api/chat/conversations')).status).toBe(401)
    expect((await userAgent().get('/api/chat/events')).status).toBe(401)
  })

  it('โหลดข้อความเก่าทีละหน้าได้ครบไม่ซ้ำ', async () => {
    const { id } = await room()
    const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id } })
    await prisma.chatMessage.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        conversationId: conversation.id,
        authorId: buyer.id,
        body: `m${i}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
      })),
    })
    const first = (await buyer.agent.get(`/api/chat/conversations/${id}/messages`)).body
    expect(first.messages).toHaveLength(50)
    expect(first.hasMore).toBe(true)
    expect(first.messages.at(-1).body).toBe('m59')
    const older = (await buyer.agent.get(`/api/chat/conversations/${id}/messages?before=${first.messages[0].id}`)).body
    expect(older.messages.map((m: { body: string }) => m.body)).toEqual(Array.from({ length: 10 }, (_, i) => `m${i}`))
    expect(older.hasMore).toBe(false)
  })
})

describe('กล่องข้อความและการอ่าน', () => {
  it('ห้องที่ยังไม่มีข้อความไม่แสดง พอมีแล้วขึ้นทั้งสองฝ่าย ล่าสุดอยู่บน', async () => {
    const a = await room()
    expect(await inbox(buyer)).toEqual([])
    expect(await inbox(seller)).toEqual([])
    await send(buyer, a.id, 'ห้องแรก')
    const b = await room()
    await send(buyer, b.id, 'ห้องสอง')
    const list = await inbox(seller)
    expect(list.map((c: { id: string }) => c.id)).toEqual([b.id, a.id])
    expect(list[0]).toMatchObject({ role: 'SELLER', unread: 1, lastMessage: { body: 'ห้องสอง' }, other: { id: buyer.id } })
    // ของตัวเองไม่นับเป็นข้อความใหม่
    expect((await inbox(buyer))[0].unread).toBe(0)
  })

  it('นับข้อความใหม่บนเมนู อ่านแล้วเป็นศูนย์ และอีกฝ่ายเห็นว่าอ่านแล้ว', async () => {
    const { id } = await room()
    await send(buyer, id, 'หนึ่ง')
    await send(buyer, id, 'สอง')
    expect(await unreadOf(seller)).toBe(2)
    expect(await unreadOf(buyer)).toBe(0)
    expect((await read(seller, id)).status).toBe(204)
    expect(await unreadOf(seller)).toBe(0)
    const { conversation } = (await buyer.agent.get(`/api/chat/conversations/${id}`)).body
    const last = await prisma.chatMessage.findFirstOrThrow({ orderBy: { createdAt: 'desc' } })
    expect(conversation.otherLastReadAt).toBe(last.createdAt.toISOString())
  })

  it('ไม่ส่งอีเมลหรือสถานะบัญชีของอีกฝ่าย', async () => {
    const { id } = await room()
    await send(buyer, id, 'สวัสดี')
    const { conversation } = (await seller.agent.get(`/api/chat/conversations/${id}`)).body
    expect(JSON.stringify(conversation)).not.toContain(buyer.email)
    expect(conversation.other).not.toHaveProperty('status')
    expect(JSON.stringify(await inbox(seller))).not.toContain(buyer.email)
  })
})

describe('บล็อกและการระงับบัญชี', () => {
  it('บล็อกแล้วส่งไม่ได้ทั้งสองทาง ทุกห้อง และเลิกบล็อกแล้วส่งได้อีก', async () => {
    const a = await room()
    const b = await room()
    const blocked = await buyer.agent.put(`/api/chat/conversations/${a.id}/block`)
    expect(blocked.body.conversation).toMatchObject({ blockedByMe: true, canSend: false })
    expect((await send(buyer, a.id, 'x')).body.error.code).toBe('CHAT_UNAVAILABLE')
    expect((await send(seller, a.id, 'x')).body.error.code).toBe('CHAT_UNAVAILABLE')
    expect((await send(seller, b.id, 'x')).body.error.code).toBe('CHAT_UNAVAILABLE')
    // อีกฝ่ายรู้แค่ว่าส่งไม่ได้ ไม่รู้ว่าถูกใครบล็อก
    const other = (await seller.agent.get(`/api/chat/conversations/${a.id}`)).body.conversation
    expect(other).toMatchObject({ blockedByMe: false, canSend: false })

    await buyer.agent.delete(`/api/chat/conversations/${a.id}/block`).expect(200)
    expect((await send(seller, a.id, 'คุยต่อ')).status).toBe(201)
  })

  it('คนที่ถูกบล็อกเลิกบล็อกแทนไม่ได้', async () => {
    const { id } = await room()
    await buyer.agent.put(`/api/chat/conversations/${id}/block`)
    await seller.agent.delete(`/api/chat/conversations/${id}/block`).expect(200)
    expect((await send(seller, id, 'x')).body.error.code).toBe('CHAT_UNAVAILABLE')
  })

  it('บล็อกแล้วดีลที่ค้างยังดำเนินต่อได้', async () => {
    const listing = await createListing(seller.id)
    const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
    const { conversation } = (await open(buyer, { offerId: body.offer.id })).body
    await seller.agent.put(`/api/chat/conversations/${conversation.id}/block`)
    expect((await seller.agent.post(`/api/offers/${body.offer.id}/accept`)).status).toBe(200)
  })

  it('อีกฝ่ายถูกระงับแล้วส่งไม่ได้', async () => {
    const { id } = await room()
    const admin = await signedInAdmin()
    await admin.agent.patch(`/api/admin/users/${seller.id}/status`).send({ status: 'SUSPENDED' }).expect(200)
    expect((await send(buyer, id, 'ยังอยู่ไหม')).body.error.code).toBe('CHAT_UNAVAILABLE')
    const { conversation } = (await buyer.agent.get(`/api/chat/conversations/${id}`)).body
    expect(conversation.canSend).toBe(false)
  })
})

describe('รูปในแชท', () => {
  it('แปลงเป็น WebP และเปิดดูได้เฉพาะคู่สนทนา', async () => {
    const { id } = await room()
    const res = await upload(buyer, id)
    expect(res.status).toBe(201)
    expect(res.body.message).toMatchObject({ body: null, image: { width: 40, height: 30 } })
    expect(res.body.message).not.toHaveProperty('imageKey')

    const url = `/api/chat/images/${res.body.message.id}`
    const image = await seller.agent.get(url)
    expect(image.status).toBe(200)
    expect(image.headers['content-type']).toContain('image/webp')
    expect(image.headers['cache-control']).toBe('no-store')
    expect((await sharp(image.body as Buffer).metadata()).format).toBe('webp')

    expect((await (await party()).agent.get(url)).status).toBe(404)
    expect((await userAgent().get(url)).status).toBe(401)
  })

  it('ไฟล์ไม่อยู่ในโฟลเดอร์สาธารณะ และเปิดผ่าน /uploads ไม่ได้', async () => {
    const { id } = await room()
    const res = await upload(buyer, id)
    const { imageKey } = await prisma.chatMessage.findUniqueOrThrow({ where: { id: res.body.message.id } })
    expect(existsSync(resolve(uploadRoot, imageKey!))).toBe(false)
    expect((await userAgent().get(`/uploads/${imageKey}`)).status).toBe(404)
    expect((await userAgent().get(`/uploads/../${env.PRIVATE_UPLOAD_DIR}/${imageKey}`)).status).toBe(404)
  })

  it('ไฟล์ที่ไม่ใช่รูปถูกปฏิเสธ และห้องที่ส่งไม่ได้ก็ส่งรูปไม่ได้', async () => {
    const { id } = await room()
    const fake = await buyer.agent.post(`/api/chat/conversations/${id}/images`).attach('image', Buffer.from('<svg/>'), 'x.png')
    expect(fake.body.error.code).toBe('INVALID_IMAGE')
    await seller.agent.put(`/api/chat/conversations/${id}/block`)
    expect((await upload(buyer, id)).body.error.code).toBe('CHAT_UNAVAILABLE')
    expect(await prisma.chatMessage.count()).toBe(0)
  })

  it('ทีมงานเปิดรูปได้เฉพาะดีลที่มีข้อพิพาท และเฉพาะรูปในห้องของดีลนั้น', async () => {
    const listing = await createListing(seller.id)
    const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
    const { offer } = (await seller.agent.post(`/api/offers/${body.offer.id}/accept`)).body
    const { conversation } = (await open(buyer, { offerId: offer.id })).body
    const sent = await upload(buyer, conversation.id)
    const other = await room()
    const elsewhere = await upload(buyer, other.id)
    const admin = await signedInAdmin()
    const url = (messageId: string) => `/api/admin/escrows/${offer.escrow.id}/messages/${messageId}/image`

    expect((await admin.agent.get(url(sent.body.message.id))).status).toBe(404)
    expect((await buyer.agent.get(url(sent.body.message.id))).status).toBe(403)

    await buyer.agent.post(`/api/escrow/${offer.escrow.id}/pay`).expect(200)
    await buyer.agent.post(`/api/escrow/${offer.escrow.id}/dispute`).send({ reason: 'x' }).expect(200)
    expect((await admin.agent.get(url(sent.body.message.id))).status).toBe(200)
    expect((await admin.agent.get(url(elsewhere.body.message.id))).status).toBe(404)
    const detail = (await admin.agent.get(`/api/admin/escrows/${offer.escrow.id}`)).body.escrow
    expect(detail.messages).toMatchObject([{ id: sent.body.message.id, image: { width: 40, height: 30 } }])
    expect(JSON.stringify(detail.messages)).not.toContain('chat/')
  })
})

describe('ส่งแบบทันที (SSE)', () => {
  let base: string
  let close: () => Promise<void>

  beforeAll(async () => {
    const server = app.listen(0)
    await new Promise((r) => server.once('listening', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    close = () => new Promise((r) => server.close(() => r()))
  })

  afterAll(async () => {
    await close()
  })


  const connect = async (email: string) => {
    const login = await fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: env.CLIENT_ORIGIN },
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    const cookie = login.headers.getSetCookie()[0]!.split(';')[0]!
    const abort = new AbortController()
    const res = await fetch(`${base}/api/chat/events`, { headers: { cookie }, signal: abort.signal })
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let closed = false
    // อ่านจนเจอ event ที่ต้องการ หรือหมดเวลา
    const next = async (timeoutMs = 3000) => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const end = buffer.indexOf('\n\n')
        if (end >= 0) {
          const frame = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          if (frame.startsWith('event: chat')) return JSON.parse(frame.split('data: ')[1]!) as Record<string, unknown>
          continue
        }
        const chunk = await Promise.race([
          reader.read(),
          new Promise<null>((r) => setTimeout(() => r(null), deadline - Date.now())),
        ])
        if (chunk === null) return null
        if (chunk.done) {
          closed = true
          return null
        }
        buffer += decoder.decode(chunk.value)
      }
      return null
    }
    return { res, next, isClosed: () => closed, stop: () => abort.abort() }
  }

  it('ข้อความถึงทั้งสองฝ่ายทันที คนนอกไม่ได้รับ', async () => {
    const { id } = await room()
    const stranger = await createUser()
    const toSeller = await connect(seller.email)
    const toBuyer = await connect(buyer.email)
    const outsider = await connect(stranger.email)
    expect(toSeller.res.headers.get('content-type')).toContain('text/event-stream')

    await send(buyer, id, 'ด่วนครับ')
    expect(await toSeller.next()).toMatchObject({ type: 'message', conversationId: id, message: { body: 'ด่วนครับ', authorId: buyer.id } })
    expect(await toBuyer.next()).toMatchObject({ type: 'message', message: { body: 'ด่วนครับ' } })
    expect(await outsider.next(300)).toBeNull()

    await read(seller, id)
    expect(await toBuyer.next()).toMatchObject({ type: 'read', conversationId: id, readerId: seller.id })

    for (const c of [toSeller, toBuyer, outsider]) c.stop()
  })

  it('รูปที่ส่งผ่าน event ไม่มี key ของไฟล์', async () => {
    const { id } = await room()
    const toSeller = await connect(seller.email)
    await upload(buyer, id)
    const event = await toSeller.next()
    expect(JSON.stringify(event)).not.toContain('chat/')
    expect(event).toMatchObject({ type: 'message', message: { image: { width: 40, height: 30 } } })
    toSeller.stop()
  })

  it('ระงับบัญชีแล้วตัดการเชื่อมต่อทันที', async () => {
    const stream = await connect(seller.email)
    const admin = await signedInAdmin()
    await admin.agent.patch(`/api/admin/users/${seller.id}/status`).send({ status: 'SUSPENDED' }).expect(200)
    expect(await stream.next()).toBeNull()
    expect(stream.isClosed()).toBe(true)
  })
})

describe('จำกัดการส่ง', () => {
  beforeAll(() => {
    env.NODE_ENV = 'development'
  })
  afterAll(() => {
    env.NODE_ENV = 'test'
  })

  it('ส่งเกิน 40 ข้อความต่อนาทีถูกจำกัดเฉพาะคนนั้น', async () => {
    const { id } = await room()
    for (let i = 0; i < 40; i++) expect((await send(buyer, id, `m${i}`)).status).toBe(201)
    expect((await send(buyer, id, 'เกิน')).body.error.code).toBe('RATE_LIMITED')
    expect((await send(seller, id, 'ยังส่งได้')).status).toBe(201)
  })
})

import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { createGame, createListing, eventsOf, signedInUser } from './helpers.js'

describe('Cache-Control ของ API', () => {
  it('ข้อมูลส่วนตัวไม่ถูกเก็บใน cache', async () => {
    const { agent } = await signedInUser()
    expect((await agent.get('/api/auth/me')).headers['cache-control']).toBe('no-store')
  })

  it('error และเส้นที่ไม่ต้องล็อกอินก็ไม่เก็บเหมือนกัน', async () => {
    expect((await request(app).get('/api/auth/me')).headers['cache-control']).toBe('no-store')
    expect((await request(app).get('/api/health')).headers['cache-control']).toBe('no-store')
    expect((await request(app).get('/api/no-such-route')).headers['cache-control']).toBe('no-store')
  })
})

describe('ตอน dev ไม่เสิร์ฟหน้าเว็บ', () => {
  it('ไม่ได้ตั้ง WEB_*_DIR -> เส้นทางนอก API เป็น 404 เพราะ Vite เสิร์ฟหน้าเว็บแทน', async () => {
    expect((await request(app).get('/')).status).toBe(404)
    expect((await request(app).get('/listings/abc')).status).toBe(404)
  })

  it('รูปที่ไม่มีอยู่ -> 404 แบบเดียวกับ API', async () => {
    const res = await request(app).get('/uploads/listings/nope.webp')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('request ที่ผิดรูปแบบเป็นความผิดของ client ไม่ใช่ระบบพัง', () => {
  it('URL ที่ encode ผิด -> 400 และไม่ลง SERVER_ERROR', async () => {
    const res = await request(app).get('/api/listings/%E0%A4%A')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
    expect(await eventsOf('SERVER_ERROR')).toHaveLength(0)
  })

  it.each(['/api/listings?q=%00', '/api/listings?game=%00', '/api/users/%00', '/api/users/%00/reviews'])(
    'NUL ใน URL ไม่ต้องล็อกอิน -> 400 และไม่ลง SERVER_ERROR: %s',
    async (path) => {
      const res = await request(app).get(path)
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(await eventsOf('SERVER_ERROR')).toHaveLength(0)
    },
  )

  it('NUL ใน body -> 400 และไม่ลง SERVER_ERROR', async () => {
    const seller = await signedInUser()
    const buyer = await signedInUser()
    const game = await createGame()
    const listing = await seller.agent.post('/api/listings').send({
      gameId: game.id,
      type: 'SALE',
      itemKind: 'SINGLE',
      title: 'Pika\u0000chu',
      setName: 'Base',
      language: 'EN',
      condition: 'NM',
      quantity: 1,
      price: 10,
    })
    expect(listing.body.error.code).toBe('VALIDATION_ERROR')

    const target = await createListing(seller.user.id)
    const offer = await buyer.agent.post('/api/offers').send({ listingId: target.id, cashAmount: 5 })
    const message = await buyer.agent.post(`/api/offers/${offer.body.offer.id}/messages`).send({ body: 'a\u0000b' })
    expect(message.body.error.code).toBe('VALIDATION_ERROR')
    expect(await eventsOf('SERVER_ERROR')).toHaveLength(0)
  })
})

describe('error ที่ไม่ได้คาดไว้', () => {
  // แอปเล็ก ๆ ที่โยน error ตามต้องการ เพราะ error จริงของระบบกระตุ้นจาก request ไม่ได้
  const throwing = (err: unknown) =>
    express()
      .get('/', () => {
        throw err
      })
      .use(errorHandler)

  it('ตอบ 500 ลง SERVER_ERROR และไม่ส่งรายละเอียดให้ client', async () => {
    const res = await request(throwing(new Error('secret db detail'))).get('/')
    expect(res.status).toBe(500)
    expect(res.body.error.code).toBe('INTERNAL_ERROR')
    expect(JSON.stringify(res.body)).not.toContain('secret')
    expect(await eventsOf('SERVER_ERROR')).toHaveLength(1)
  })

  it('error ที่ติด status 5xx ยังนับเป็นระบบพัง', async () => {
    const err = Object.assign(new Error('upstream down'), { status: 503 })
    expect((await request(throwing(err)).get('/')).status).toBe(500)
    expect(await eventsOf('SERVER_ERROR')).toHaveLength(1)
  })
})

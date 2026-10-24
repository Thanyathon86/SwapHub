import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { uploadRoot } from '../src/lib/storage.js'
import { createListing, createUser, signedInUser, userAgent, type Agent } from './helpers.js'

const profileBody = (overrides: object = {}) => ({
  displayName: 'สมชาย',
  username: 'somchai',
  bio: 'สะสม Pokémon ตั้งแต่ปี 99',
  location: 'กรุงเทพฯ',
  ...overrides,
})
const update = (agent: Agent, body: object) => agent.patch('/api/me/profile').send(body)

describe('username อัตโนมัติ', () => {
  it('บัญชีใหม่ได้ชื่อสุ่ม user_xxxxxxxx ไม่ซ้ำกัน และส่งมาใน /auth/me', async () => {
    const a = await createUser()
    const b = await createUser()
    expect(a.username).toMatch(/^user_[0-9a-f]{8}$/)
    expect(a.username).not.toBe(b.username)
    const { agent } = await signedInUser()
    expect((await agent.get('/api/auth/me')).body.user).toMatchObject({ username: expect.stringMatching(/^user_/), avatarKey: null })
  })
})

describe('แก้โปรไฟล์', () => {
  it('บันทึกได้ username เป็นตัวพิมพ์เล็กเสมอ และคืน user ชุดใหม่', async () => {
    const { agent } = await signedInUser()
    const res = await update(agent, profileBody({ username: 'SomChai' }))
    expect(res.body.user).toMatchObject({ username: 'somchai', displayName: 'สมชาย' })
    expect((await agent.get('/api/auth/me')).body.user.username).toBe('somchai')
  })

  it('ช่องว่างใน bio/location แปลว่าลบ', async () => {
    const { user, agent } = await signedInUser()
    await update(agent, profileBody())
    await update(agent, profileBody({ bio: '', location: '  ' }))
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toMatchObject({ bio: null, location: null })
  })

  it('username ซ้ำ -> USERNAME_TAKEN', async () => {
    await createUser({ username: 'somchai' })
    const { agent } = await signedInUser()
    expect((await update(agent, profileBody())).body.error.code).toBe('USERNAME_TAKEN')
  })

  it('รูปแบบผิดหรือชื่อสงวนไม่ได้', async () => {
    const { agent } = await signedInUser()
    for (const username of ['ab', 'has space', '.dot', 'dot.', 'a..b', 'ไทย', 'x'.repeat(21)]) {
      expect((await update(agent, profileBody({ username }))).body.error.code).toBe('VALIDATION_ERROR')
    }
    for (const username of ['admin', 'real_admin', 'swaphub.th', 'support_team', 'root']) {
      expect((await update(agent, profileBody({ username }))).body.error.code).toBe('USERNAME_RESERVED')
    }
  })

  it('bio ยาวเกิน 150 ไม่ได้', async () => {
    const { agent } = await signedInUser()
    expect((await update(agent, profileBody({ bio: 'ก'.repeat(151) }))).body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ต้องล็อกอิน', async () => {
    expect((await update(userAgent(), profileBody())).status).toBe(401)
  })
})

describe('รูปโปรไฟล์', () => {
  const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: '#09c' } }).png().toBuffer()

  it('ครอปเป็น 400x400 WebP, เปลี่ยนรูปแล้วลบไฟล์เก่า, ลบรูปได้', async () => {
    const { agent } = await signedInUser()
    const first = await agent.post('/api/me/avatar').attach('image', await png(1200, 800), 'me.png')
    const firstKey = first.body.user.avatarKey as string
    expect(firstKey).toMatch(/^avatars\/.+\.webp$/)
    const served = await request(app).get(`/uploads/${firstKey}`)
    expect(await sharp(served.body as Buffer).metadata()).toMatchObject({ width: 400, height: 400, format: 'webp' })

    const second = await agent.post('/api/me/avatar').attach('image', await png(500, 500), 'me2.png')
    expect(second.body.user.avatarKey).not.toBe(firstKey)
    expect(existsSync(resolve(uploadRoot, firstKey))).toBe(false)

    const removed = await agent.delete('/api/me/avatar')
    expect(removed.body.user.avatarKey).toBeNull()
    expect(existsSync(resolve(uploadRoot, second.body.user.avatarKey))).toBe(false)
  })

  it('ไฟล์ที่ไม่ใช่รูป -> INVALID_IMAGE', async () => {
    const { agent } = await signedInUser()
    const res = await agent.post('/api/me/avatar').attach('image', Buffer.from('nope'), 'x.png')
    expect(res.body.error.code).toBe('INVALID_IMAGE')
  })
})

describe('โปรไฟล์สาธารณะ GET /api/users/:username', () => {
  it('ดูได้โดยไม่ต้องล็อกอิน มีประกาศที่เปิดอยู่และจำนวนดีล ไม่มีอีเมล', async () => {
    const seller = await createUser({ username: 'seller1', bio: 'hi' })
    await createListing(seller.id)
    await createListing(seller.id, { status: 'PENDING_REVIEW' })
    const res = await request(app).get('/api/users/Seller1')
    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({ username: 'seller1', bio: 'hi', stats: { activeListings: 1, deals: 0 } })
    expect(res.body.listings).toHaveLength(1)
    expect(JSON.stringify(res.body)).not.toContain('@test.local')
  })

  it('บัญชีที่ถูกระงับ, บัญชี admin และชื่อที่ไม่มี -> 404 เหมือนกัน', async () => {
    await createUser({ username: 'banned1', status: 'SUSPENDED' })
    await createUser({ username: 'boss1', role: 'ADMIN' })
    for (const name of ['banned1', 'boss1', 'nobody']) {
      expect((await request(app).get(`/api/users/${name}`)).body.error.code).toBe('PROFILE_NOT_FOUND')
    }
  })

  it('ข้อมูลผู้ขายในประกาศมี username กับรูปโปรไฟล์ให้ลิงก์ไปโปรไฟล์ได้', async () => {
    const seller = await createUser({ username: 'seller2' })
    const listing = await createListing(seller.id)
    const res = await request(app).get(`/api/listings/${listing.id}`)
    expect(res.body.listing.seller).toEqual({ id: seller.id, displayName: 'Test User', username: 'seller2', avatarKey: null })
  })
})

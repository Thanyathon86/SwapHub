import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { prisma } from '../src/lib/prisma.js'
import { uploadRoot } from '../src/lib/storage.js'
import { createListing, eventsOf, signedInUser, type Agent } from './helpers.js'

let seller: Agent
let sellerId: string

beforeEach(async () => {
  const s = await signedInUser()
  seller = s.agent
  sellerId = s.user.id
})

// รูป JPEG ที่มี EXIF ติดมา เหมือนรูปจากมือถือ
const jpeg = (width = 2000, height = 1000) =>
  sharp({ create: { width, height, channels: 3, background: '#c00' } })
    .jpeg()
    .withExif({ IFD0: { ImageDescription: 'secret-location' } })
    .toBuffer()

const upload = async (agent: Agent, listingId: string, file?: Buffer, name = 'card.jpg') =>
  agent.post(`/api/listings/${listingId}/images`).attach('image', file ?? (await jpeg()), name)

const fileOf = (key: string) => resolve(uploadRoot, key)

describe('อัปโหลดรูป', () => {
  it('ย่อด้านยาวเหลือ 1600px แปลงเป็น WebP ตัด EXIF และเสิร์ฟที่ /uploads', async () => {
    const listing = await createListing(sellerId, { status: 'PENDING_REVIEW' })
    const res = await upload(seller, listing.id)
    expect(res.status).toBe(201)
    const [image] = res.body.listing.images
    expect(image).toMatchObject({ width: 1600, height: 800 })
    expect(image.key).toMatch(new RegExp(`^listings/${listing.id}/[0-9a-f-]+\\.webp$`))

    const served = await request(app).get(`/uploads/${image.key}`)
    expect(served.status).toBe(200)
    expect(served.headers['content-type']).toBe('image/webp')
    const meta = await sharp(served.body as Buffer).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.exif).toBeUndefined()
    // ชื่อไฟล์เป็น uuid ไม่เคยถูกเขียนทับ รูปจึงต้อง cache ได้ ไม่เหมือน response ของ API
    expect(served.headers['cache-control']).toContain('immutable')
  })

  it('รับ JPEG, PNG และ WebP', async () => {
    const listing = await createListing(sellerId, { status: 'PENDING_REVIEW' })
    const blank = () => sharp({ create: { width: 20, height: 20, channels: 3, background: '#09c' } })
    expect((await upload(seller, listing.id, await blank().jpeg().toBuffer(), 'a.jpg')).status).toBe(201)
    expect((await upload(seller, listing.id, await blank().png().toBuffer(), 'a.png')).status).toBe(201)
    expect((await upload(seller, listing.id, await blank().webp().toBuffer(), 'a.webp')).status).toBe(201)
  })

  it('ชนิดอื่นที่ sharp อ่านได้ (SVG, GIF, TIFF) ไม่รับ', async () => {
    const listing = await createListing(sellerId)
    const blank = () => sharp({ create: { width: 20, height: 20, channels: 3, background: '#09c' } })
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20"/></svg>')
    const files = [svg, await blank().gif().toBuffer(), await blank().tiff().toBuffer()]
    for (const file of files) {
      const res = await upload(seller, listing.id, file, 'card.jpg')
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_IMAGE')
      // รูปโปรไฟล์ใช้อีกเส้นทางแต่ต้องกันเหมือนกัน
      expect((await seller.post('/api/me/avatar').attach('image', file, 'a.jpg')).body.error.code).toBe('INVALID_IMAGE')
    }
    expect(await prisma.listingImage.count()).toBe(0)
  })

  it('ขึ้นต้นเหมือน JPEG แต่เนื้อไฟล์ไม่ใช่รูป ก็ไม่รับ', async () => {
    const listing = await createListing(sellerId)
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from('<script>alert(1)</script>')])
    expect((await upload(seller, listing.id, fake, 'card.jpg')).body.error.code).toBe('INVALID_IMAGE')
  })

  it('ไฟล์ที่ไม่ใช่รูปจริง ถึงจะตั้งชื่อ .jpg ก็ไม่รับ และไม่บันทึกอะไร', async () => {
    const listing = await createListing(sellerId)
    const res = await upload(seller, listing.id, Buffer.from('not really an image'), 'fake.jpg')
    expect(res.body.error.code).toBe('INVALID_IMAGE')
    expect(await prisma.listingImage.count()).toBe(0)
  })

  it('ไฟล์ใหญ่เกิน 5MB -> 413', async () => {
    const listing = await createListing(sellerId)
    const res = await upload(seller, listing.id, Buffer.alloc(5 * 1024 * 1024 + 1), 'big.jpg')
    expect(res.status).toBe(413)
    expect(res.body.error.code).toBe('IMAGE_TOO_LARGE')
  })

  it('multipart ผิดรูปแบบ -> 400 ไม่ใช่ 500 และไม่ลง SERVER_ERROR', async () => {
    const listing = await createListing(sellerId)
    const send = (contentType: string, body: string) =>
      seller.post(`/api/listings/${listing.id}/images`).set('content-type', contentType).send(body)
    const noBoundary = await send('multipart/form-data', 'x')
    const cutOff = await send(
      'multipart/form-data; boundary=abc',
      '--abc\r\nContent-Disposition: form-data; name="image"; filename="a.png"\r\n\r\nxx',
    )
    for (const res of [noBoundary, cutOff]) {
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_UPLOAD')
    }
    expect(await eventsOf('SERVER_ERROR')).toHaveLength(0)
  })

  it('ไม่ส่งไฟล์มา -> INVALID_UPLOAD', async () => {
    const listing = await createListing(sellerId)
    expect((await seller.post(`/api/listings/${listing.id}/images`)).body.error.code).toBe('INVALID_UPLOAD')
  })

  it('อัปโหลดเข้าประกาศของคนอื่นไม่ได้ (404)', async () => {
    const listing = await createListing(sellerId)
    const other = await signedInUser()
    expect((await upload(other.agent, listing.id)).status).toBe(404)
  })

  it('ได้สูงสุด 6 รูป รูปที่ 7 ถูกปฏิเสธและไม่ทิ้งไฟล์ค้าง', async () => {
    const listing = await createListing(sellerId, { status: 'PENDING_REVIEW' })
    for (let i = 0; i < 6; i++) expect((await upload(seller, listing.id, await jpeg(200, 280))).status).toBe(201)
    const res = await upload(seller, listing.id, await jpeg(200, 280))
    expect(res.body.error.code).toBe('TOO_MANY_IMAGES')
    const keys = (await prisma.listingImage.findMany()).map((i) => i.key)
    expect(keys).toHaveLength(6)
    // ทุกแถวมีไฟล์จริง
    expect(keys.every((k) => existsSync(fileOf(k)))).toBe(true)
  })

  it('เพิ่มรูปให้ประกาศที่เปิดอยู่ -> กลับไปรอตรวจ และยกเลิกข้อเสนอที่ค้าง', async () => {
    const listing = await createListing(sellerId)
    const buyer = await signedInUser()
    const { body } = await buyer.agent.post('/api/offers').send({ listingId: listing.id, cashAmount: 10 })
    expect((await upload(seller, listing.id)).body.listing.status).toBe('PENDING_REVIEW')
    expect((await prisma.offer.findUnique({ where: { id: body.offer.id } }))?.status).toBe('CANCELLED')
  })

  it('ประกาศที่ปิดแล้วเพิ่มรูปไม่ได้', async () => {
    const listing = await createListing(sellerId, { status: 'CLOSED' })
    expect((await upload(seller, listing.id)).body.error.code).toBe('LISTING_NOT_EDITABLE')
  })
})

describe('ลบรูป', () => {
  it('ลบทั้งแถวใน DB และไฟล์', async () => {
    const listing = await createListing(sellerId, { status: 'PENDING_REVIEW' })
    const [image] = (await upload(seller, listing.id)).body.listing.images
    const res = await seller.delete(`/api/listings/${listing.id}/images/${image.id}`)
    expect(res.body.listing.images).toEqual([])
    expect(existsSync(fileOf(image.key))).toBe(false)
  })

  it('ลบรูปของประกาศคนอื่นไม่ได้', async () => {
    const listing = await createListing(sellerId, { status: 'PENDING_REVIEW' })
    const [image] = (await upload(seller, listing.id)).body.listing.images
    const other = await signedInUser()
    expect((await other.agent.delete(`/api/listings/${listing.id}/images/${image.id}`)).status).toBe(404)
    expect(existsSync(fileOf(image.key))).toBe(true)
  })
})

it('หน้าตลาดส่งรูปมาด้วยเรียงตามลำดับ', async () => {
  const listing = await createListing(sellerId, { status: 'PENDING_REVIEW' })
  await upload(seller, listing.id, await jpeg(300, 300))
  await upload(seller, listing.id, await jpeg(400, 400))
  await prisma.listing.update({ where: { id: listing.id }, data: { status: 'ACTIVE' } })
  const res = await request(app).get(`/api/listings/${listing.id}`)
  expect(res.body.listing.images.map((i: { width: number }) => i.width)).toEqual([300, 400])
})

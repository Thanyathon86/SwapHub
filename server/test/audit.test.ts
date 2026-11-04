import sharp from 'sharp'
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '../src/lib/prisma.js'
import { createGame, createListing, signedInAdmin, signedInUser, type Agent } from './helpers.js'

let admin: Agent
let adminId: string

beforeEach(async () => {
  const a = await signedInAdmin({ displayName: 'Boss' })
  admin = a.agent
  adminId = a.user.id
})

const logs = () => prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } })

describe('ตรวจประกาศ', () => {
  const review = (id: string, body: object) => admin.patch(`/api/admin/listings/${id}/review`).send(body)

  it('อนุมัติ -> บันทึกผู้ตรวจ ผู้ขาย และการ์ดใบไหน', async () => {
    const { user: seller } = await signedInUser()
    const listing = await createListing(seller.id, { status: 'PENDING_REVIEW', title: 'Pikachu' })
    expect((await review(listing.id, { decision: 'APPROVE' })).status).toBe(200)

    const [log] = await logs()
    expect(log).toMatchObject({ action: 'LISTING_APPROVED', actorId: adminId, targetUserId: seller.id })
    expect(log?.detail).toContain('Pikachu')
    expect(log?.detail).toContain(listing.id)
  })

  it('ปฏิเสธ -> บันทึกเหตุผลด้วย', async () => {
    const { user: seller } = await signedInUser()
    const listing = await createListing(seller.id, { status: 'PENDING_REVIEW', title: 'Pikachu' })
    await review(listing.id, { decision: 'REJECT', reason: 'รูปไม่ชัด' })

    const [log] = await logs()
    expect(log).toMatchObject({ action: 'LISTING_REJECTED', targetUserId: seller.id })
    expect(log?.detail).toContain('รูปไม่ชัด')
  })

  it('ประวัติยังอยู่ แม้ผู้ขายแก้ประกาศจนผลตรวจบนแถวประกาศถูกล้าง', async () => {
    const { user: seller, agent } = await signedInUser()
    const game = await createGame()
    const listing = await createListing(seller.id, { gameId: game.id, status: 'PENDING_REVIEW', title: 'Pikachu' })
    await review(listing.id, { decision: 'APPROVE' })
    await agent.patch(`/api/listings/${listing.id}`).send({
      gameId: game.id,
      type: 'SALE',
      itemKind: 'SINGLE',
      title: 'Charizard',
      setName: 'Base Set',
      language: 'EN',
      condition: 'NM',
      quantity: 1,
      price: 100,
    })
    expect((await prisma.listing.findUniqueOrThrow({ where: { id: listing.id } })).reviewedById).toBeNull()
    const [log] = await logs()
    expect(log).toMatchObject({ action: 'LISTING_APPROVED', actorId: adminId })
    expect(log?.detail).toContain('Pikachu')
  })

  it('ตรวจซ้ำไม่สำเร็จ -> ไม่มีบันทึกเพิ่ม', async () => {
    const { user: seller } = await signedInUser()
    const listing = await createListing(seller.id, { status: 'PENDING_REVIEW' })
    await review(listing.id, { decision: 'APPROVE' })
    expect((await review(listing.id, { decision: 'REJECT', reason: 'x' })).body.error.code).toBe('LISTING_ALREADY_REVIEWED')
    expect(await logs()).toHaveLength(1)
  })
})

describe('เกมและบริษัทเกรด', () => {
  const jpeg = () => sharp({ create: { width: 20, height: 20, channels: 3, background: '#c00' } }).jpeg().toBuffer()

  it('เพิ่มเกม -> บันทึกโดยไม่มีผู้ใช้เป้าหมาย', async () => {
    await admin.post('/api/admin/games').send({ name: 'Digimon', slug: 'digimon' })
    const [log] = await logs()
    expect(log).toMatchObject({ action: 'CATALOG_CHANGED', actorId: adminId, targetUserId: null })
    expect(log?.detail).toContain('Digimon')
  })

  it('ปิดเกมและเปลี่ยนชื่อ -> บอกว่าเปลี่ยนอะไร', async () => {
    const game = await createGame({ name: 'Digimon', slug: 'digimon' })
    await admin.patch(`/api/admin/games/${game.id}`).send({ isActive: false })
    await admin.patch(`/api/admin/games/${game.id}`).send({ name: 'Digimon TCG', slug: 'digimon-tcg' })
    const [closed, renamed] = await logs()
    expect(closed?.detail).toContain('ปิดใช้งาน')
    expect(renamed?.detail).toContain('Digimon TCG')
    expect(renamed?.detail).toContain('digimon-tcg')
  })

  it('กดบันทึกโดยไม่ได้แก้อะไร -> ไม่ลงประวัติ', async () => {
    const game = await createGame({ name: 'Digimon', slug: 'digimon' })
    expect((await admin.patch(`/api/admin/games/${game.id}`).send({ name: 'Digimon', isActive: true })).status).toBe(200)
    expect(await logs()).toHaveLength(0)
  })

  it('บันทึกไม่สำเร็จ (ชื่อซ้ำ) -> ไม่มีประวัติค้าง', async () => {
    await createGame({ name: 'Digimon', slug: 'digimon' })
    expect((await admin.post('/api/admin/games').send({ name: 'Digimon', slug: 'other' })).status).toBe(409)
    const game = await createGame({ name: 'Other', slug: 'other' })
    expect((await admin.patch(`/api/admin/games/${game.id}`).send({ slug: 'digimon' })).status).toBe(409)
    expect(await logs()).toHaveLength(0)
  })

  it('แก้เกมที่ไม่มีอยู่ -> 404 เหมือนเดิม', async () => {
    const res = await admin.patch('/api/admin/games/00000000-0000-4000-8000-000000000000').send({ isActive: false })
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('GAME_NOT_FOUND')
  })

  it('เปลี่ยนและลบรูปเกม -> ลงประวัติ แต่ลบตอนไม่มีรูปไม่ลง', async () => {
    const game = await createGame({ name: 'Digimon', slug: 'digimon' })
    await admin.delete(`/api/admin/games/${game.id}/image`)
    expect(await logs()).toHaveLength(0)

    await admin.post(`/api/admin/games/${game.id}/image`).attach('image', await jpeg(), 'game.jpg')
    await admin.delete(`/api/admin/games/${game.id}/image`)
    const [changed, removed] = await logs()
    expect(changed?.detail).toContain('เปลี่ยนรูป')
    expect(removed?.detail).toContain('ลบรูป')
  })

  it('บริษัทเกรดบันทึกแบบเดียวกัน', async () => {
    const { body } = await admin.post('/api/admin/grading-companies').send({ name: 'ARS' })
    await admin.patch(`/api/admin/grading-companies/${body.gradingCompany.id}`).send({ isActive: false })
    await admin.patch(`/api/admin/grading-companies/${body.gradingCompany.id}`).send({ isActive: false })
    const rows = await logs()
    expect(rows).toHaveLength(2)
    expect(rows[0]?.detail).toContain('ARS')
    expect(rows[1]?.detail).toContain('ปิดใช้งาน')
  })
})

describe('เรื่องที่แจ้ง', () => {
  const openTicket = async (agent: Agent) =>
    (await agent.post('/api/support/tickets').send({ subject: 'ลืมรหัส', category: 'ACCOUNT', body: 'ช่วยด้วย' })).body.ticket.id as string

  it('admin ปิดเรื่อง -> บันทึกว่าใครปิดเรื่องของใคร', async () => {
    const { user, agent } = await signedInUser()
    const id = await openTicket(agent)
    expect((await admin.post(`/api/admin/support/tickets/${id}/close`)).status).toBe(200)
    const [log] = await logs()
    expect(log).toMatchObject({ action: 'TICKET_CLOSED', actorId: adminId, targetUserId: user.id })
    expect(log?.detail).toContain('ลืมรหัส')
  })

  it('ผู้ใช้ปิดเรื่องของตัวเอง หรือปิดซ้ำไม่สำเร็จ -> ไม่ลงประวัติ', async () => {
    const { agent } = await signedInUser()
    const id = await openTicket(agent)
    await agent.post(`/api/support/tickets/${id}/close`)
    expect((await admin.post(`/api/admin/support/tickets/${id}/close`)).body.error.code).toBe('TICKET_CLOSED')
    expect(await logs()).toHaveLength(0)
  })
})

describe('หน้าประวัติ', () => {
  it('รายการที่ไม่มีผู้ใช้เป้าหมายส่ง targetUser เป็น null และ dashboard ไม่พัง', async () => {
    await admin.post('/api/admin/games').send({ name: 'Digimon', slug: 'digimon' })
    const res = await admin.get('/api/admin/audit-logs')
    expect(res.body.logs[0]).toMatchObject({ action: 'CATALOG_CHANGED', targetUser: null, actor: { displayName: 'Boss' } })
    const dashboard = await admin.get('/api/admin/dashboard')
    expect(dashboard.status).toBe(200)
    expect(dashboard.body.recentAudit[0].targetUser).toBeNull()
  })

  it('กรองตามประเภทได้ และจำนวนรวมตรงกับที่กรอง', async () => {
    const { user: seller } = await signedInUser()
    const listing = await createListing(seller.id, { status: 'PENDING_REVIEW' })
    await admin.patch(`/api/admin/listings/${listing.id}/review`).send({ decision: 'APPROVE' })
    await admin.post('/api/admin/games').send({ name: 'Digimon', slug: 'digimon' })

    const all = await admin.get('/api/admin/audit-logs')
    expect(all.body.total).toBe(2)
    const filtered = await admin.get('/api/admin/audit-logs?action=LISTING_APPROVED')
    expect(filtered.body.total).toBe(1)
    expect(filtered.body.logs.map((l: { action: string }) => l.action)).toEqual(['LISTING_APPROVED'])
    expect((await admin.get('/api/admin/audit-logs?action=NOPE')).body.error.code).toBe('VALIDATION_ERROR')
  })

  it('การ์ดบน dashboard ไม่นับการอนุมัติประกาศ ไม่ให้ดันการเปลี่ยนสิทธิ์ตกจากรายการ', async () => {
    const { user: seller } = await signedInUser()
    await admin.patch(`/api/admin/users/${seller.id}/status`).send({ status: 'SUSPENDED' })
    await admin.patch(`/api/admin/users/${seller.id}/status`).send({ status: 'ACTIVE' })
    for (let i = 0; i < 6; i++) {
      const listing = await createListing(seller.id, { status: 'PENDING_REVIEW' })
      await admin.patch(`/api/admin/listings/${listing.id}/review`).send({ decision: 'APPROVE' })
    }
    const { body } = await admin.get('/api/admin/dashboard')
    expect(body.recentAudit.map((l: { action: string }) => l.action)).toEqual(['USER_REACTIVATED', 'USER_SUSPENDED'])
    // หน้าประวัติเต็มยังเห็นครบ
    expect((await admin.get('/api/admin/audit-logs')).body.total).toBe(8)
  })

  it('ไม่มี API แก้หรือลบประวัติ', async () => {
    const { body } = await admin.post('/api/admin/games').send({ name: 'Digimon', slug: 'digimon' })
    expect(body.game.id).toBeDefined()
    const [log] = await logs()
    expect((await admin.delete(`/api/admin/audit-logs/${log?.id}`)).status).toBe(404)
    expect((await admin.patch(`/api/admin/audit-logs/${log?.id}`).send({ detail: 'x' })).status).toBe(404)
    expect(await logs()).toHaveLength(1)
  })

  it('ผู้ใช้ทั่วไปอ่านประวัติไม่ได้', async () => {
    const { agent } = await signedInUser()
    expect((await agent.get('/api/admin/audit-logs')).status).toBe(403)
  })
})

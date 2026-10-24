import { beforeEach, describe, expect, it } from 'vitest'
import { signedInAdmin, signedInUser, userAgent, type Agent } from './helpers.js'

let user: Agent
let admin: Agent

beforeEach(async () => {
  user = (await signedInUser()).agent
  admin = (await signedInAdmin({ displayName: 'Staff Name' })).agent
})

const open = (agent: Agent, subject = 'ประกาศไม่ขึ้น') =>
  agent.post('/api/support/tickets').send({ subject, category: 'LISTING', body: 'ลงไปสองวันแล้ว' })

describe('ฝั่งผู้ใช้', () => {
  it('ต้องล็อกอิน และ validate input', async () => {
    expect((await userAgent().get('/api/support/tickets')).status).toBe(401)
    const bad = await user.post('/api/support/tickets').send({ subject: '', category: 'NOPE', body: '' })
    expect(bad.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('เปิดเรื่องได้ สถานะ OPEN พร้อมข้อความแรก', async () => {
    const res = await open(user)
    expect(res.status).toBe(201)
    expect(res.body.ticket).toMatchObject({ status: 'OPEN', messages: [{ fromStaff: false }] })
  })

  it('คนอื่นดูหรือตอบเรื่องของเราไม่ได้ (404 เหมือนไม่มีอยู่)', async () => {
    const { body } = await open(user)
    const stranger = (await signedInUser()).agent
    expect((await stranger.get(`/api/support/tickets/${body.ticket.id}`)).body.error.code).toBe('TICKET_NOT_FOUND')
    expect((await stranger.post(`/api/support/tickets/${body.ticket.id}/messages`).send({ body: 'x' })).status).toBe(404)
  })

  it('เปิดค้างได้ไม่เกิน 5 เรื่อง', async () => {
    for (let i = 0; i < 5; i++) expect((await open(user, `เรื่อง ${i}`)).status).toBe(201)
    expect((await open(user, 'เรื่องที่ 6')).body.error.code).toBe('TOO_MANY_OPEN_TICKETS')
  })
})

describe('การคุยระหว่างผู้ใช้กับทีมงาน', () => {
  it('admin ตอบ -> ANSWERED และรับเรื่องอัตโนมัติ, ผู้ใช้ตอบกลับ -> OPEN', async () => {
    const { body } = await open(user)
    const id = body.ticket.id as string
    const answered = await admin.post(`/api/admin/support/tickets/${id}/messages`).send({ body: 'กำลังตรวจสอบครับ' })
    expect(answered.body.ticket).toMatchObject({ status: 'ANSWERED', assignee: { displayName: 'Staff Name' } })
    const replied = await user.post(`/api/support/tickets/${id}/messages`).send({ body: 'ขอบคุณครับ' })
    expect(replied.body.ticket.status).toBe('OPEN')
    expect(replied.body.ticket.messages).toHaveLength(3)
  })

  it('ฝั่งผู้ใช้ไม่รู้ว่า admin คนไหนตอบ', async () => {
    const { body } = await open(user)
    await admin.post(`/api/admin/support/tickets/${body.ticket.id}/messages`).send({ body: 'ตอบแล้ว' })
    const res = await user.get(`/api/support/tickets/${body.ticket.id}`)
    expect(JSON.stringify(res.body)).not.toContain('Staff Name')
    expect(res.body.ticket.assignee).toBeUndefined()
    expect(res.body.ticket.messages[1]).toEqual({
      id: expect.any(String),
      body: 'ตอบแล้ว',
      fromStaff: true,
      createdAt: expect.any(String),
    })
  })

  it('ปิดแล้วตอบต่อไม่ได้ทั้งสองฝ่าย และเปิดเรื่องใหม่ได้', async () => {
    const { body } = await open(user)
    const id = body.ticket.id as string
    expect((await user.post(`/api/support/tickets/${id}/close`)).body.ticket.status).toBe('CLOSED')
    expect((await user.post(`/api/support/tickets/${id}/messages`).send({ body: 'x' })).body.error.code).toBe('TICKET_CLOSED')
    expect((await admin.post(`/api/admin/support/tickets/${id}/messages`).send({ body: 'x' })).body.error.code).toBe(
      'TICKET_CLOSED',
    )
  })

  it('admin กรองตามสถานะ รับเรื่อง และปิดเรื่องได้', async () => {
    const { body } = await open(user)
    const id = body.ticket.id as string
    expect((await admin.get('/api/admin/support/tickets')).body.tickets.map((t: { id: string }) => t.id)).toEqual([id])
    expect((await admin.post(`/api/admin/support/tickets/${id}/assign`)).body.ticket.assignee.displayName).toBe('Staff Name')
    await admin.post(`/api/admin/support/tickets/${id}/close`)
    expect((await admin.get('/api/admin/support/tickets?status=CLOSED')).body.tickets).toHaveLength(1)
  })
})

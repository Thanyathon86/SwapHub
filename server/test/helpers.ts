import request from 'supertest'
import { app } from '../src/app.js'
import { env } from '../src/config/env.js'
import type { Prisma } from '../src/generated/prisma/client.js'
import type { EventType } from '../src/generated/prisma/enums.js'
import { waitForEventWrites } from '../src/lib/events.js'
import { hashPassword } from '../src/lib/password.js'
import { prisma } from '../src/lib/prisma.js'

export const PASSWORD = 'Passw0rd!long'

// agent เก็บ cookie ระหว่าง request ให้เหมือน browser ที่ล็อกอินค้างไว้
// ใส่ Origin เสมอเพราะ checkOrigin ปฏิเสธ request แก้ข้อมูลที่ไม่มี Origin
export const userAgent = () => request.agent(app).set('origin', env.CLIENT_ORIGIN)
export const adminAgent = () => request.agent(app).set('origin', env.ADMIN_ORIGIN)
export type Agent = ReturnType<typeof userAgent>

let seq = 0
const uniqueEmail = (prefix: string) => `${prefix}${++seq}@test.local`

// สร้างตรงใน DB เร็วกว่าผ่าน API และไม่ทิ้ง event log ที่ test อื่นต้องนับ
export const createUser = async (data: Partial<Prisma.UserCreateInput> = {}) =>
  prisma.user.create({
    data: {
      email: uniqueEmail(data.role === 'ADMIN' ? 'admin' : 'user'),
      displayName: 'Test User',
      passwordHash: await hashPassword(PASSWORD),
      ...data,
    },
  })

export const loginUser = async (email: string, password = PASSWORD) => {
  const agent = userAgent()
  const res = await agent.post('/api/auth/login').send({ email, password })
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`)
  return agent
}

export const loginAdmin = async (email: string, password = PASSWORD) => {
  const agent = adminAgent()
  const res = await agent.post('/api/auth/admin/login').send({ email, password })
  if (res.status !== 200) throw new Error(`admin login failed: ${res.status} ${JSON.stringify(res.body)}`)
  return agent
}

// ผู้ใช้ใหม่ที่ล็อกอินแล้ว คืนทั้งข้อมูลใน DB และ agent ไว้ยิง request
export const signedInUser = async (data: Partial<Prisma.UserCreateInput> = {}) => {
  const user = await createUser(data)
  return { user, agent: await loginUser(user.email) }
}

export const signedInAdmin = async (data: Partial<Prisma.UserCreateInput> = {}) => {
  const user = await createUser({ ...data, role: 'ADMIN' })
  return { user, agent: await loginAdmin(user.email) }
}

export const createGame = (data: Partial<Prisma.GameCreateInput> = {}) =>
  prisma.game.create({ data: { name: `Game ${++seq}`, slug: `game-${seq}`, ...data } })

// ประกาศที่ผ่านการตรวจแล้ว (ACTIVE) เป็นค่าเริ่มต้น เพราะ test ส่วนใหญ่ต้องการประกาศที่อยู่ในตลาด
export const createListing = async (sellerId: string, data: Partial<Prisma.ListingUncheckedCreateInput> = {}) =>
  prisma.listing.create({
    data: {
      sellerId,
      gameId: data.gameId ?? (await createGame()).id,
      type: 'SALE',
      itemKind: 'SINGLE',
      status: 'ACTIVE',
      title: 'Pikachu',
      setName: 'Base Set',
      language: 'EN',
      condition: 'NM',
      quantity: 1,
      price: 100,
      ...data,
    },
  })

// log เขียนแบบไม่รอ ต้องรอให้เขียนเสร็จก่อนนับ
export const eventsOf = async (type: EventType) => {
  await waitForEventWrites()
  return prisma.eventLog.findMany({ where: { type }, orderBy: { createdAt: 'asc' } })
}

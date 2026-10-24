import { afterAll, beforeEach } from 'vitest'
import { waitForEventWrites } from '../src/lib/events.js'
import { prisma } from '../src/lib/prisma.js'

// ล้างทุกตารางก่อนแต่ละเคส ให้แต่ละ test ไม่ขึ้นกับลำดับหรือข้อมูลที่ test อื่นทิ้งไว้
beforeEach(async () => {
  // log เขียนแบบไม่รอ ต้องรอให้เสร็จก่อนล้าง ไม่งั้นจะเขียนทับเข้ามาในเคสถัดไป
  await waitForEventWrites()
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  if (tables.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`)
  }
})

afterAll(async () => {
  await waitForEventWrites()
  await prisma.$disconnect()
})

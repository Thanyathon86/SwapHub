import { parse } from 'dotenv'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

// ใช้ DB แยกชื่อ <ชื่อเดิม>_test จาก DATABASE_URL เดียวกัน ไม่ต้องเพิ่ม env และ test จะไม่แตะข้อมูลที่ใช้ dev
const devUrl = process.env.DATABASE_URL ?? parse(readFileSync('.env')).DATABASE_URL
if (!devUrl) throw new Error('DATABASE_URL is not set')
const url = new URL(devUrl)
url.pathname = `${url.pathname.replace(/_test$/, '')}_test`
const testUrl = url.toString()
// กันพลาดสุดท้าย: test ล้างทุกตารางก่อนแต่ละเคส ห้ามชี้ไป DB ของ dev เด็ดขาด
if (testUrl === devUrl) throw new Error('Refusing to run tests against the development database')

// ตั้งใน process ด้วยเพื่อให้ globalSetup (ซึ่งรันใน process นี้) migrate DB ถูกตัว
process.env.DATABASE_URL = testUrl

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/globalSetup.ts'],
    setupFiles: ['test/setup.ts'],
    // ทุกไฟล์ใช้ DB เดียวกันและล้างตารางก่อนแต่ละเคส รันพร้อมกันจะทับข้อมูลกัน
    fileParallelism: false,
    env: { DATABASE_URL: testUrl, NODE_ENV: 'test' },
    // argon2 กับ DB ทำให้บางเคสช้ากว่าค่า default 5 วินาทีได้บนเครื่องช้า
    testTimeout: 20_000,
  },
})

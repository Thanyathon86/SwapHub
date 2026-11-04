import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { app } from '../src/app.js'
import { env } from '../src/config/env.js'
import { createUser, eventsOf, PASSWORD, userAgent } from './helpers.js'

// rate limit ปิดตอน NODE_ENV=test เปิดกลับเฉพาะไฟล์นี้ได้เพราะ vitest แยก module ต่อไฟล์ ไม่กระทบ test อื่น
// ทำเหมือนอยู่หลัง proxy หนึ่งตัว จะได้สลับ IP ผ่าน X-Forwarded-For
beforeAll(() => {
  env.NODE_ENV = 'development'
  app.set('trust proxy', 1)
})

afterAll(() => {
  env.NODE_ENV = 'test'
  app.set('trust proxy', env.TRUST_PROXY)
})

const from = (ip: string) => userAgent().set('x-forwarded-for', ip)

// test แต่ละอันใช้ IP ของตัวเอง เพราะตัวนับอยู่ใน memory ไม่ถูกล้างระหว่างเคส
const login = (ip: string, email: string, password: string) => from(ip).post('/api/auth/login').send({ email, password })
const forgot = (ip: string, email: string) => from(ip).post('/api/auth/forgot-password').send({ email })

describe('จำกัดต่อ IP', () => {
  it('ล็อกอินผิดเกิน 10 ครั้ง -> 429 และบันทึก RATE_LIMITED', async () => {
    for (let i = 0; i < 10; i++) expect((await from('203.0.113.1').post('/api/auth/login').send({})).status).toBe(400)
    const res = await from('203.0.113.1').post('/api/auth/login').send({})
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
    expect((await eventsOf('RATE_LIMITED'))[0]).toMatchObject({ detail: 'auth', ip: '203.0.113.1' })
  })

  it('สมัครสำเร็จก็นับ เกิน 20 ครั้งต่อชั่วโมง -> 429', async () => {
    const register = (i: number) =>
      from('203.0.113.2').post('/api/auth/register').send({ email: `reg${i}@test.local`, password: PASSWORD, displayName: 'New' })
    for (let i = 0; i < 20; i++) expect((await register(i)).status).toBe(201)
    expect((await register(20)).status).toBe(429)
    // IP อื่นยังสมัครได้
    const other = await from('203.0.113.3').post('/api/auth/register').send({ email: 'other@test.local', password: PASSWORD, displayName: 'New' })
    expect(other.status).toBe(201)
  }, 60_000)

  it('ขอลิงก์ลืมรหัสเกิน 5 ครั้ง -> 429 แม้เป็นคนละอีเมล', async () => {
    for (let i = 0; i < 5; i++) expect((await forgot('203.0.113.4', `ip${i}@test.local`)).status).toBe(204)
    expect((await forgot('203.0.113.4', 'ip-last@test.local')).status).toBe(429)
  })
})

describe('จำกัดต่อบัญชี (ยิงจากหลาย IP)', () => {
  it('ล็อกอินผิดเกิน 30 ครั้งจากคนละ IP -> บัญชีนั้นโดนบล็อก แต่บัญชีอื่นไม่โดน', async () => {
    const target = await createUser()
    const other = await createUser()
    for (let i = 0; i < 30; i++) expect((await login(`198.51.100.${i + 1}`, target.email, 'wrong-password')).status).toBe(401)

    // รหัสถูกก็เข้าไม่ได้จนกว่าจะหมดรอบ ตัวพิมพ์ใหญ่ก็นับเป็นบัญชีเดียวกัน
    expect((await login('198.51.100.100', target.email, PASSWORD)).status).toBe(429)
    expect((await login('198.51.100.101', target.email.toUpperCase(), PASSWORD)).status).toBe(429)
    expect((await login('198.51.100.102', other.email, PASSWORD)).status).toBe(200)
  }, 60_000)

  it('อีเมลที่ไม่มีบัญชีโดนจำกัดแบบเดียวกัน เดาจากตัวนับไม่ได้ว่ามีบัญชีไหม', async () => {
    for (let i = 0; i < 30; i++) expect((await login(`192.0.2.${i + 1}`, 'ghost@test.local', 'wrong-password')).status).toBe(401)
    expect((await login('192.0.2.100', 'ghost@test.local', 'wrong-password')).status).toBe(429)
  }, 60_000)

  it('ขอลิงก์ลืมรหัสของอีเมลเดียวเกิน 5 ครั้งจากคนละ IP -> 429 ทั้งอีเมลที่มีและไม่มีบัญชี', async () => {
    const user = await createUser()
    for (const email of [user.email, 'ghost-reset@test.local']) {
      for (let i = 0; i < 5; i++) expect((await forgot(`198.18.0.${i + 1}`, email)).status).toBe(204)
      expect((await forgot('198.18.0.100', email)).status).toBe(429)
    }
  })

  it('ไม่ส่ง header ของตัวนับต่ออีเมล คนนอกจะได้ไม่เห็นว่าบัญชีนี้ถูกลองไปแล้วกี่ครั้ง', async () => {
    const forgotRes = await forgot('198.18.1.1', 'fresh@test.local')
    // ตัวนับต่อ IP ยังส่งตามปกติ แสดงว่าดูถูก header แล้ว
    expect(forgotRes.headers['ratelimit-policy']).toContain('5-in-15min')
    expect(forgotRes.headers['ratelimit-policy']).not.toContain('5-in-1hr')

    const loginRes = await login('198.18.1.2', 'fresh@test.local', 'wrong-password')
    expect(loginRes.headers['ratelimit-policy']).toContain('10-in-15min')
    expect(loginRes.headers['ratelimit-policy']).not.toContain('30-in-15min')
  })
})

import { describe, expect, it } from 'vitest'
import { envSchema } from '../src/config/env.js'

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:secret@db.example.com:5432/app',
  CLIENT_ORIGIN: 'https://tcgnexus.example',
  ADMIN_ORIGIN: 'https://admin.tcgnexus.example',
  SMTP_URL: 'smtps://user:pass@smtp.example.com:465',
  WEB_CLIENT_DIR: '../client/dist',
  WEB_ADMIN_DIR: '../admin/dist',
  MOCK_PAYMENTS_ENABLED: 'true',
}

const failedFields = (input: object) => {
  const result = envSchema.safeParse(input)
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'))
}

describe('env ตอน production', () => {
  it('ตั้งครบแล้วผ่าน', () => {
    expect(failedFields(production)).toEqual([])
  })

  it('origin ต้องเป็น https', () => {
    expect(failedFields({ ...production, CLIENT_ORIGIN: 'http://tcgnexus.example' })).toEqual(['CLIENT_ORIGIN'])
    expect(failedFields({ ...production, ADMIN_ORIGIN: 'http://admin.tcgnexus.example' })).toEqual(['ADMIN_ORIGIN'])
  })

  it('ลืมตั้ง ADMIN_ORIGIN แล้วค่าเริ่มต้น localhost ใช้ไม่ได้', () => {
    const { ADMIN_ORIGIN: _omit, ...rest } = production
    expect(failedFields(rest)).toEqual(['ADMIN_ORIGIN'])
  })

  it('ต้องยืนยันว่ารู้ตัวว่าการจ่ายเงินเป็นแบบจำลอง', () => {
    const { MOCK_PAYMENTS_ENABLED: _omit, ...rest } = production
    expect(failedFields(rest)).toEqual(['MOCK_PAYMENTS_ENABLED'])
    expect(failedFields({ ...production, MOCK_PAYMENTS_ENABLED: 'false' })).toEqual(['MOCK_PAYMENTS_ENABLED'])
  })

  it('ต้องมี SMTP_URL ไม่งั้นลิงก์ลืมรหัสผ่านส่งไม่ได้', () => {
    const { SMTP_URL: _omit, ...rest } = production
    expect(failedFields(rest)).toEqual(['SMTP_URL'])
  })
})

describe('env ของรูปส่วนตัว', () => {
  const base = { DATABASE_URL: production.DATABASE_URL, CLIENT_ORIGIN: 'http://localhost:5173' }

  it('ต้องอยู่นอกโฟลเดอร์ที่เปิดสาธารณะ', () => {
    expect(failedFields({ ...base, UPLOAD_DIR: 'files', PRIVATE_UPLOAD_DIR: 'files/chat' })).toEqual(['PRIVATE_UPLOAD_DIR'])
    expect(failedFields({ ...base, UPLOAD_DIR: 'files', PRIVATE_UPLOAD_DIR: 'files' })).toEqual(['PRIVATE_UPLOAD_DIR'])
  })

  it('ชื่อขึ้นต้นเหมือนกันแต่คนละโฟลเดอร์ใช้ได้', () => {
    expect(failedFields({ ...base, UPLOAD_DIR: 'uploads', PRIVATE_UPLOAD_DIR: 'uploads-private' })).toEqual([])
  })
})

describe('env ของการเสิร์ฟหน้าเว็บ', () => {
  it('production ต้องตั้งโฟลเดอร์ build ทั้งสองแอป ไม่งั้นหน้าเว็บจะไม่มี security header', () => {
    const { WEB_CLIENT_DIR: _client, ...noClient } = production
    expect(failedFields(noClient)).toEqual(['WEB_CLIENT_DIR'])
    const { WEB_ADMIN_DIR: _admin, ...noAdmin } = production
    expect(failedFields(noAdmin)).toEqual(['WEB_ADMIN_DIR'])
  })

  it('สองแอปต้องคนละ hostname เพราะแยกแอปด้วย hostname', () => {
    const sameHost = { ...production, ADMIN_ORIGIN: 'https://tcgnexus.example:8443' }
    expect(failedFields(sameHost)).toEqual(['ADMIN_ORIGIN'])
  })

  it('URL ผิดรูปแบบรายงานเป็น error ปกติ ไม่ทำให้ตัวตรวจ env พัง', () => {
    expect(failedFields({ ...production, CLIENT_ORIGIN: 'not-a-url' })).toContain('CLIENT_ORIGIN')
  })
})

describe('env ตอน dev', () => {
  it('ใช้ http ไม่ตั้ง SMTP และไม่เสิร์ฟหน้าเว็บได้', () => {
    const dev = { DATABASE_URL: production.DATABASE_URL, CLIENT_ORIGIN: 'http://localhost:5173' }
    expect(failedFields(dev)).toEqual([])
  })
})

describe('อายุ session', () => {
  const dev = { DATABASE_URL: production.DATABASE_URL, CLIENT_ORIGIN: 'http://localhost:5173' }

  it('เพดานต้องไม่น้อยกว่าอายุที่ต่อได้', () => {
    expect(failedFields({ ...dev, SESSION_TTL_DAYS: 10, SESSION_ABSOLUTE_DAYS: 5 })).toEqual(['SESSION_ABSOLUTE_DAYS'])
    expect(failedFields({ ...dev, ADMIN_SESSION_TTL_HOURS: 24, ADMIN_SESSION_ABSOLUTE_HOURS: 12 })).toEqual(['ADMIN_SESSION_ABSOLUTE_HOURS'])
  })

  it('ค่าเริ่มต้นของ admin สั้นกว่าผู้ใช้ทั่วไป', () => {
    const parsed = envSchema.parse(dev)
    expect(parsed.ADMIN_SESSION_TTL_HOURS).toBeLessThan(parsed.SESSION_TTL_DAYS * 24)
    expect(parsed.ADMIN_SESSION_ABSOLUTE_HOURS).toBeLessThan(parsed.SESSION_ABSOLUTE_DAYS * 24)
  })
})

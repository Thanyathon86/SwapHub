import { describe, expect, it } from 'vitest'
import { envSchema } from '../src/config/env.js'

const production = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://app:secret@db.example.com:5432/app',
  CLIENT_ORIGIN: 'https://tcgnexus.example',
  ADMIN_ORIGIN: 'https://admin.tcgnexus.example',
  SMTP_URL: 'smtps://user:pass@smtp.example.com:465',
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

  it('ต้องมี SMTP_URL ไม่งั้นลิงก์ลืมรหัสผ่านส่งไม่ได้', () => {
    const { SMTP_URL: _omit, ...rest } = production
    expect(failedFields(rest)).toEqual(['SMTP_URL'])
  })
})

describe('env ตอน dev', () => {
  it('ใช้ http และไม่ตั้ง SMTP ได้', () => {
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

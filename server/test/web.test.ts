import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { env } from '../src/config/env.js'
import { serveWeb } from '../src/middleware/serveWeb.js'

const CLIENT_HOST = 'shop.test'
const ADMIN_HOST = 'admin.shop.test'

// จำลองผลลัพธ์ของ vite build ไม่ต้อง build จริงตอนรัน test
const root = mkdtempSync(join(tmpdir(), 'ge175-web-'))
const buildOf = (name: string) => {
  const dir = join(root, name)
  mkdirSync(join(dir, 'assets'), { recursive: true })
  writeFileSync(join(dir, 'index.html'), `<!doctype html><title>${name} app</title>`)
  writeFileSync(join(dir, 'favicon.png'), name)
  writeFileSync(join(dir, 'assets', 'index-abc123.js'), `console.log('${name}')`)
  return dir
}
writeFileSync(join(root, 'secret.txt'), 'TOP-SECRET')
const clientDir = buildOf('client')
const adminDir = buildOf('admin')
writeFileSync(join(adminDir, 'only-admin.txt'), 'ADMIN-ONLY')

// app อ่าน env ตอน import จึงต้องตั้งค่าก่อนแล้วค่อย import ไฟล์นี้ไม่ใช้ helpers.ts เพราะ helpers import app ทันที
// vitest แยก module ต่อไฟล์ จึงไม่กระทบ test อื่น
env.CLIENT_ORIGIN = `https://${CLIENT_HOST}`
env.ADMIN_ORIGIN = `https://${ADMIN_HOST}`
env.WEB_CLIENT_DIR = clientDir
env.WEB_ADMIN_DIR = adminDir
const { app } = await import('../src/app.js')

afterAll(() => rmSync(root, { recursive: true, force: true }))

const get = (host: string, path: string) => request(app).get(path).set('Host', host)

describe('แยกแอปตาม hostname', () => {
  it('แต่ละ host ได้หน้าของแอปตัวเอง', async () => {
    const client = await get(CLIENT_HOST, '/')
    expect(client.status).toBe(200)
    expect(client.text).toContain('client app')
    expect(client.headers['content-type']).toContain('text/html')
    expect((await get(ADMIN_HOST, '/')).text).toContain('admin app')
  })

  it('port ไม่มีผลกับการเลือกแอป และตัวพิมพ์ใหญ่ก็นับเป็น host เดียวกัน', async () => {
    expect((await get(`${CLIENT_HOST}:8443`, '/')).text).toContain('client app')
    expect((await get(ADMIN_HOST.toUpperCase(), '/')).text).toContain('admin app')
  })

  it('Host ที่ไม่รู้จักไม่ได้หน้าเว็บ', async () => {
    const res = await get('evil.example', '/')
    expect(res.status).toBe(404)
    expect(res.text).not.toContain(' app')
  })

  it('ไฟล์ของแอปหนึ่งเปิดจากอีก host ไม่ได้', async () => {
    expect((await get(ADMIN_HOST, '/only-admin.txt')).text).toBe('ADMIN-ONLY')
    expect((await get(CLIENT_HOST, '/only-admin.txt')).text).not.toContain('ADMIN-ONLY')
  })

  it('อยู่หลัง proxy ใช้ X-Forwarded-Host เฉพาะตอนตั้ง TRUST_PROXY', async () => {
    const viaProxy = () => request(app).get('/').set('Host', 'internal:4000').set('X-Forwarded-Host', ADMIN_HOST)
    // ไม่ได้ตั้ง TRUST_PROXY: header นี้ client ปลอมมาได้ ห้ามเชื่อ
    expect((await viaProxy()).status).toBe(404)
    app.set('trust proxy', 1)
    try {
      expect((await viaProxy()).text).toContain('admin app')
    } finally {
      app.set('trust proxy', env.TRUST_PROXY)
    }
  })

  it('ตั้งโฟลเดอร์ที่ยังไม่ได้ build -> หยุดตั้งแต่เริ่มแอป', () => {
    expect(() => serveWeb({ [CLIENT_HOST]: join(root, 'missing') })).toThrow('index.html')
  })
})

describe('เส้นทางของหน้าเว็บ', () => {
  it.each(['/listings/abc', '/u/john.doe', '/reset-password?token=abc', '/admin/users'])(
    'ลิงก์ตรงไปหน้าย่อย %s ได้ index.html และไม่ cache',
    async (path) => {
      const res = await get(CLIENT_HOST, path)
      expect(res.status).toBe(200)
      expect(res.text).toContain('client app')
      expect(res.headers['cache-control']).toBe('no-cache')
    },
  )

  it('ไฟล์ใน assets cache ได้นาน', async () => {
    const res = await get(CLIENT_HOST, '/assets/index-abc123.js')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('javascript')
    expect(res.headers['cache-control']).toContain('immutable')
  })

  it('ไฟล์นอก assets เช่น favicon ไม่ตั้งให้ cache นาน', async () => {
    const res = await get(CLIENT_HOST, '/favicon.png')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).not.toContain('immutable')
  })

  it('ไฟล์ใน assets ที่ไม่มีอยู่ -> 404 ไม่ใช่ index.html', async () => {
    const res = await get(CLIENT_HOST, '/assets/index-oldhash.js')
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('client app')
  })

  it.each(['/..%2fsecret.txt', '/..%2f..%2fsecret.txt', '/assets/..%2f..%2fsecret.txt', '/%2e%2e/%2e%2e/secret.txt'])(
    'เปิดไฟล์นอกโฟลเดอร์ build ไม่ได้: %s',
    async (path) => {
      expect((await get(CLIENT_HOST, path)).text).not.toContain('TOP-SECRET')
    },
  )

  it('URL ที่ encode ผิดเป็นความผิดของ client', async () => {
    expect((await get(CLIENT_HOST, '/%E0%A4%A')).status).toBe(400)
  })
})

describe('API กับรูปไม่ถูกหน้าเว็บทับ', () => {
  it('API ตอบ JSON ตามปกติทั้งสอง host', async () => {
    for (const host of [CLIENT_HOST, ADMIN_HOST]) {
      expect((await get(host, '/api/health')).body).toEqual({ status: 'ok' })
      const missing = await get(host, '/api/no-such-route')
      expect(missing.status).toBe(404)
      expect(missing.body.error.code).toBe('NOT_FOUND')
    }
  })

  it('รูปที่ไม่มีอยู่ -> 404 ไม่ใช่ index.html', async () => {
    const res = await get(CLIENT_HOST, '/uploads/listings/nope.webp')
    expect(res.status).toBe(404)
    expect(res.text).not.toContain('client app')
  })

  it('ยังกัน CSRF ตาม origin ของแต่ละแอป', async () => {
    const login = (origin: string) =>
      request(app)
        .post('/api/auth/login')
        .set('Host', CLIENT_HOST)
        .set('Origin', origin)
        .send({ email: 'nobody@test.local', password: 'wrong-password' })
    expect((await login(`https://${CLIENT_HOST}`)).body.error.code).toBe('INVALID_CREDENTIALS')
    expect((await login(`https://${ADMIN_HOST}`)).body.error.code).toBe('INVALID_CREDENTIALS')
    expect((await login('https://evil.example')).body.error.code).toBe('INVALID_ORIGIN')
  })
})

describe('security header', () => {
  const directives = (csp: string) => new Map(csp.split(';').map((d) => {
    const [name = '', ...values] = d.trim().split(/\s+/)
    return [name, values]
  }))

  it('หน้าเว็บมี CSP แบบไม่ยอม inline script และห้ามฝังใน iframe', async () => {
    const res = await get(CLIENT_HOST, '/')
    const csp = directives(res.headers['content-security-policy'] ?? '')
    expect(csp.get('default-src')).toEqual(["'self'"])
    expect(csp.get('script-src')).toEqual(["'self'"])
    expect(csp.get('script-src-attr')).toEqual(["'none'"])
    expect(csp.get('object-src')).toEqual(["'none'"])
    expect(csp.get('base-uri')).toEqual(["'self'"])
    expect(csp.get('frame-ancestors')).toEqual(["'none'"])
    expect(res.headers['content-security-policy']).not.toContain('unsafe')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })

  it('อนุญาตเฉพาะแหล่งที่หน้าเว็บใช้จริง', async () => {
    const csp = directives((await get(CLIENT_HOST, '/')).headers['content-security-policy'] ?? '')
    expect(csp.get('style-src')).toEqual(["'self'", 'https://fonts.googleapis.com'])
    expect(csp.get('font-src')).toEqual(["'self'", 'https://fonts.gstatic.com'])
    expect(csp.get('img-src')).toEqual(["'self'", 'blob:'])
  })

  it('มี HSTS, nosniff, ไม่ส่ง referrer (ลิงก์รีเซ็ตรหัสมี token ใน URL) และปิดความสามารถที่ไม่ใช้', async () => {
    const res = await get(CLIENT_HOST, '/reset-password?token=abc')
    expect(res.headers['strict-transport-security']).toContain('max-age=')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
    expect(res.headers['permissions-policy']).toContain('camera=()')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('assets และ API ได้ header ชุดเดียวกัน', async () => {
    for (const path of ['/assets/index-abc123.js', '/api/health']) {
      const res = await get(ADMIN_HOST, path)
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'")
      expect(res.headers['x-content-type-options']).toBe('nosniff')
    }
  })
})

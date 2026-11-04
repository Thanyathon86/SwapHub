import 'dotenv/config'
import { z } from 'zod'

// superRefine ยังทำงานแม้ URL ผิดรูปแบบ (error จากด้านล่างจะรายงานให้อยู่แล้ว) จึงห้าม new URL แบบที่ throw ได้
const hostnameOf = (origin: string) => (URL.canParse(origin) ? new URL(origin).hostname : origin)

// ตรวจ env ตอนเริ่มแอป ถ้าขาดหรือผิดรูปแบบให้หยุดทันที
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  CLIENT_ORIGIN: z.url(),
  // แอปหลังบ้าน (admin/) ใช้ API ตัวเดียวกันแต่คนละ origin
  ADMIN_ORIGIN: z.url().default('http://localhost:5174'),
  // จำนวน proxy ที่อยู่หน้าแอป (0 = ต่อตรง) ไม่ใช้ true เพราะจะเชื่อ X-Forwarded-For ที่ client ปลอมมาได้
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  // อายุ session นับจากใช้งานล่าสุด (ต่ออายุอัตโนมัติ)
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  // เพดานอายุนับจาก login ต่ออายุเกินนี้ไม่ได้ ต้อง login ใหม่ กัน session ที่อยู่ได้ตลอดไปถ้าโดนขโมย
  SESSION_ABSOLUTE_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  // session ของ admin ใช้ค่าชุดนี้แทน นับเป็นชั่วโมงเพราะควรสั้นกว่าผู้ใช้ทั่วไปมาก
  ADMIN_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(2),
  ADMIN_SESSION_ABSOLUTE_HOURS: z.coerce.number().int().min(1).max(720).default(12),
  // log เหตุการณ์ (EventLog) เก่ากว่านี้ถูกลบอัตโนมัติ ไม่รวม AuditLog ที่เก็บถาวร
  LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(60),
  // โฟลเดอร์เก็บรูปที่อัปโหลด (path สัมพัทธ์นับจากโฟลเดอร์ server)
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  // โฟลเดอร์ build ของหน้าเว็บ ตั้งแล้ว Express เสิร์ฟหน้าเว็บเองพร้อม security header (ตอน dev ไม่ต้องตั้ง Vite เสิร์ฟให้)
  WEB_CLIENT_DIR: z.string().min(1).optional(),
  WEB_ADMIN_DIR: z.string().min(1).optional(),
  // ไม่ตั้ง = ไม่ส่งอีเมลจริง พิมพ์ลง console แทน (ใช้ตอน dev) รูปแบบ smtp(s)://user:pass@host:port
  SMTP_URL: z.string().regex(/^smtps?:\/\//, 'Must start with smtp:// or smtps://').optional(),
  MAIL_FROM: z.string().min(3).default('TCGNexus <no-reply@tcgnexus.local>'),
  // production ต้องตั้งเป็น true เอง กันการเปิดเว็บจริงที่รับเงินจำลองโดยไม่รู้ตัว (ตอนนี้ lib/payments.ts มีแค่แบบจำลอง)
  MOCK_PAYMENTS_ENABLED: z.stringbool().default(false),
  // ใช้เฉพาะตอน seed admin คนแรก แอปปกติไม่ต้องมี
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
}).superRefine((e, ctx) => {
  if (e.SESSION_ABSOLUTE_DAYS < e.SESSION_TTL_DAYS) {
    ctx.addIssue({ code: 'custom', path: ['SESSION_ABSOLUTE_DAYS'], message: 'Must be greater than or equal to SESSION_TTL_DAYS' })
  }
  if (e.ADMIN_SESSION_ABSOLUTE_HOURS < e.ADMIN_SESSION_TTL_HOURS) {
    ctx.addIssue({ code: 'custom', path: ['ADMIN_SESSION_ABSOLUTE_HOURS'], message: 'Must be greater than or equal to ADMIN_SESSION_TTL_HOURS' })
  }

  // serveWeb แยกแอปด้วย hostname ถ้าซ้ำกันจะเปิดได้แค่แอปเดียว
  if (e.WEB_CLIENT_DIR && e.WEB_ADMIN_DIR && hostnameOf(e.CLIENT_ORIGIN) === hostnameOf(e.ADMIN_ORIGIN)) {
    ctx.addIssue({ code: 'custom', path: ['ADMIN_ORIGIN'], message: 'Must use a different hostname from CLIENT_ORIGIN when serving the web apps' })
  }

  // ค่าเริ่มต้นตั้งไว้สำหรับ dev ถ้าเผลอใช้บน production แอปจะยังรันได้แต่ไม่ปลอดภัย จึงให้หยุดตั้งแต่ตอนเริ่ม
  if (e.NODE_ENV !== 'production') return
  for (const key of ['CLIENT_ORIGIN', 'ADMIN_ORIGIN'] as const) {
    if (!e[key].startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: [key], message: 'Must use https in production' })
    }
  }
  for (const key of ['WEB_CLIENT_DIR', 'WEB_ADMIN_DIR'] as const) {
    if (!e[key]) {
      ctx.addIssue({ code: 'custom', path: [key], message: 'Required in production, the web apps need the security headers set by this server' })
    }
  }
  if (!e.MOCK_PAYMENTS_ENABLED) {
    ctx.addIssue({ code: 'custom', path: ['MOCK_PAYMENTS_ENABLED'], message: 'Must be true in production, escrow payments are simulated and no real money moves' })
  }
  if (!e.SMTP_URL) {
    ctx.addIssue({ code: 'custom', path: ['SMTP_URL'], message: 'Required in production, password reset emails cannot be sent without it' })
  }
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors)
  process.exit(1)
}

export const env = parsed.data

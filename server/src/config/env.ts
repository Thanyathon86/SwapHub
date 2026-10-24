import 'dotenv/config'
import { z } from 'zod'

// ตรวจ env ตอนเริ่มแอป ถ้าขาดหรือผิดรูปแบบให้หยุดทันที
const envSchema = z.object({
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
  // log เหตุการณ์ (EventLog) เก่ากว่านี้ถูกลบอัตโนมัติ ไม่รวม AuditLog ที่เก็บถาวร
  LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(60),
  // โฟลเดอร์เก็บรูปที่อัปโหลด (path สัมพัทธ์นับจากโฟลเดอร์ server)
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  // ไม่ตั้ง = ไม่ส่งอีเมลจริง พิมพ์ลง console แทน (ใช้ตอน dev) รูปแบบ smtp(s)://user:pass@host:port
  SMTP_URL: z.string().regex(/^smtps?:\/\//, 'Must start with smtp:// or smtps://').optional(),
  MAIL_FROM: z.string().min(3).default('SwapHub <no-reply@swaphub.local>'),
  // ใช้เฉพาะตอน seed admin คนแรก แอปปกติไม่ต้องมี
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
}).refine((e) => e.SESSION_ABSOLUTE_DAYS >= e.SESSION_TTL_DAYS, {
  path: ['SESSION_ABSOLUTE_DAYS'],
  message: 'Must be greater than or equal to SESSION_TTL_DAYS',
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors)
  process.exit(1)
}

export const env = parsed.data

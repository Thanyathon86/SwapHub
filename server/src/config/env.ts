import 'dotenv/config'
import { z } from 'zod'

// ตรวจ env ตอนเริ่มแอป ถ้าขาดหรือผิดรูปแบบให้หยุดทันที
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.url(),
  CLIENT_ORIGIN: z.url(),
  // จำนวน proxy ที่อยู่หน้าแอป (0 = ต่อตรง) ไม่ใช้ true เพราะจะเชื่อ X-Forwarded-For ที่ client ปลอมมาได้
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', z.flattenError(parsed.error).fieldErrors)
  process.exit(1)
}

export const env = parsed.data

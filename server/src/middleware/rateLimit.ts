import type { NextFunction, Request } from 'express'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'
import { logEventThrottled } from '../lib/events.js'

const WINDOW_MS = 15 * 60 * 1000

// ส่งต่อให้ errorHandler เพื่อให้ response 429 รูปแบบเดียวกับ error อื่น
// ปิดตอนรัน test เพราะ test ล็อกอินผิดหลายครั้งติดกันโดยตั้งใจ และทุกเคสมาจาก IP เดียวกัน
const skip = () => env.NODE_ENV === 'test'

const rateLimited = () => new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later')

// บันทึกครั้งเดียวต่อ IP ต่อรอบ ไม่ให้คนที่ยิงรัวทำให้ตาราง log บวม
const onLimited = (name: string) => (req: Request, _res: unknown, next: NextFunction) => {
  logEventThrottled(`rate:${name}:${req.ip}`, WINDOW_MS, req, { type: 'RATE_LIMITED', statusCode: 429, detail: name })
  next(rateLimited())
}

export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 300,
  skip,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: onLimited('api'),
})

// ขอลิงก์ลืมรหัสผ่านตอบสำเร็จเสมอ authLimiter (นับแค่ครั้งที่ล้มเหลว) จึงกันไม่ได้
// นับทุกครั้ง กันคนยิงอีเมลรัว ๆ ใส่กล่องจดหมายของคนอื่น
export const resetLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 5,
  skip,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: onLimited('reset'),
})

// สำหรับ login/register ให้เข้มกว่าเพื่อชะลอการเดารหัสผ่าน
// นับเฉพาะครั้งที่ล้มเหลว (status >= 400) คนที่ล็อกอินถูกบ่อย ๆ ไม่ควรโดนบล็อก
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  skip,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: onLimited('auth'),
})

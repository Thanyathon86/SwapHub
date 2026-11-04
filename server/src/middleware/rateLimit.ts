import type { NextFunction, Request } from 'express'
import rateLimit, { type Options } from 'express-rate-limit'
import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'
import { logEventThrottled } from '../lib/events.js'

const WINDOW_MS = 15 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000

// ส่งต่อให้ errorHandler เพื่อให้ response 429 รูปแบบเดียวกับ error อื่น
// ปิดตอนรัน test เพราะ test ล็อกอินผิดหลายครั้งติดกันโดยตั้งใจ และทุกเคสมาจาก IP เดียวกัน
const skip = () => env.NODE_ENV === 'test'

const rateLimited = () => new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later')

// บันทึกครั้งเดียวต่อ IP ต่อรอบ ไม่ให้คนที่ยิงรัวทำให้ตาราง log บวม
const onLimited = (name: string) => (req: Request, _res: unknown, next: NextFunction) => {
  logEventThrottled(`rate:${name}:${req.ip}`, WINDOW_MS, req, { type: 'RATE_LIMITED', statusCode: 429, detail: name })
  next(rateLimited())
}

const limiter = (name: string, options: Partial<Options>) =>
  rateLimit({
    windowMs: WINDOW_MS,
    skip,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: onLimited(name),
    ...options,
  })

export const apiLimiter = limiter('api', { limit: 300 })

// ขอลิงก์ลืมรหัสผ่านตอบสำเร็จเสมอ authLimiter (นับแค่ครั้งที่ล้มเหลว) จึงกันไม่ได้
// นับทุกครั้ง กันคนยิงอีเมลรัว ๆ ใส่กล่องจดหมายของคนอื่น
export const resetLimiter = limiter('reset', { limit: 5 })

// สำหรับ login/register ให้เข้มกว่าเพื่อชะลอการเดารหัสผ่าน
// นับเฉพาะครั้งที่ล้มเหลว (status >= 400) คนที่ล็อกอินถูกบ่อย ๆ ไม่ควรโดนบล็อก
export const authLimiter = limiter('auth', { limit: 10, skipSuccessfulRequests: true })

// authLimiter ไม่นับครั้งที่สำเร็จ จึงสร้างบัญชีรัว ๆ ได้ และแต่ละครั้งกิน CPU กับ RAM ของ argon2
// ไม่ตั้งต่ำเกินไป เพราะคนใน Wi-Fi หรือเครือข่ายมือถือเดียวกันใช้ IP ร่วมกัน
export const registerLimiter = limiter('register', { limit: 20, windowMs: HOUR_MS })

// ต้องอยู่หลัง validate เพราะใช้อีเมลที่ normalize แล้ว เปลี่ยนตัวพิมพ์เพื่อหลบตัวนับไม่ได้
// ไม่ส่ง header จำนวนครั้งที่เหลือ คนอื่นไม่ควรเห็นว่าบัญชีนี้ถูกลองไปแล้วกี่ครั้ง
const perEmail: Partial<Options> = {
  keyGenerator: (req) => (req.body as { email: string }).email,
  standardHeaders: false,
}

// กันเดารหัสบัญชีเดียวจากหลาย IP ซึ่งตัวนับต่อ IP กันไม่ได้
// ข้อแลกเปลี่ยน: คนที่รู้อีเมลเหยื่อทำให้เจ้าของล็อกอินไม่ได้ชั่วคราวได้ จึงตั้งเพดานสูงกว่า authLimiter และบล็อกแค่จนหมดรอบ
export const loginAccountLimiter = limiter('login-account', { ...perEmail, limit: 30, skipSuccessfulRequests: true })

// ตัวนับต่อ IP กันการยิงอีเมลใส่คนเดียวจากหลาย IP ไม่ได้ ตอบ 429 เหมือนกันทุกอีเมลจึงไม่บอกว่ามีบัญชีไหม
export const resetAccountLimiter = limiter('reset-account', { ...perEmail, limit: 5, windowMs: HOUR_MS })

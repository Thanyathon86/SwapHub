import rateLimit from 'express-rate-limit'
import { AppError } from '../lib/errors.js'

const WINDOW_MS = 15 * 60 * 1000

// ส่งต่อให้ errorHandler เพื่อให้ response 429 รูปแบบเดียวกับ error อื่น
const rateLimited = () => new AppError(429, 'RATE_LIMITED', 'Too many requests, please try again later')

export const apiLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(rateLimited()),
})

// สำหรับ login/register ให้เข้มกว่าเพื่อชะลอการเดารหัสผ่าน
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(rateLimited()),
})

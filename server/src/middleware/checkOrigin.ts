import type { RequestHandler } from 'express'
import { env } from '../config/env.js'
import { AppError } from '../lib/errors.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const allowedOrigin = new URL(env.CLIENT_ORIGIN).origin

// กัน CSRF: browser ส่ง Origin มากับ request ที่แก้ข้อมูลเสมอ เว็บอื่นปลอมค่านี้ไม่ได้
// ไม่มี Origin ก็ปฏิเสธ (client ที่ไม่ใช่ browser ต้องใส่ header เอง)
export const checkOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next()
  if (req.get('origin') !== allowedOrigin) {
    throw new AppError(403, 'INVALID_ORIGIN', 'Request origin not allowed')
  }
  next()
}

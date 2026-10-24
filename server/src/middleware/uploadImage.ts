import type { RequestHandler } from 'express'
import multer from 'multer'
import { AppError } from '../lib/errors.js'

const MAX_BYTES = 5 * 1024 * 1024

// เก็บใน memory เพราะต้องส่งให้ sharp แปลงก่อนเขียนลง storage อยู่แล้ว และจำกัดขนาดไว้ไม่ให้ RAM เต็ม
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 0 },
}).single('image')

// แปลง error ของ multer ให้เป็นรูปแบบเดียวกับ error อื่นของ API
export const uploadImage: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'IMAGE_TOO_LARGE', 'Image must be 5MB or smaller'))
      return next(new AppError(400, 'INVALID_UPLOAD', 'Send exactly one file in the "image" field'))
    }
    if (err) return next(err)
    if (!req.file) return next(new AppError(400, 'INVALID_UPLOAD', 'Send exactly one file in the "image" field'))
    next()
  })
}

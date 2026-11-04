import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.js'

type Schemas = {
  params?: z.ZodType
  query?: z.ZodType
  body?: z.ZodType
}

// Postgres เก็บ NUL ในข้อความไม่ได้ ถ้าปล่อยถึง DB จะตอบ 500 และลง SERVER_ERROR ทั้งที่ request ผิดเอง
// ตรวจกับค่าหลัง schema parse แล้ว โครงสร้างจึงตื้นตาม schema ไม่ต้องกลัว JSON ที่ซ้อนลึกผิดปกติ
const hasNul = (value: unknown): boolean => {
  if (typeof value === 'string') return value.includes('\0')
  if (Array.isArray(value)) return value.some(hasNul)
  return typeof value === 'object' && value !== null && Object.values(value).some(hasNul)
}

// ควรใช้ z.strictObject ใน schema เพื่อปฏิเสธฟิลด์ที่ไม่ได้ประกาศ (กันส่ง role/status มาเอง)
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req, _res, next) => {
    const errors: Record<string, ReturnType<typeof z.flattenError>> = {}

    for (const key of ['params', 'query', 'body'] as const) {
      const schema = schemas[key]
      if (!schema) continue

      const result = schema.safeParse(req[key])
      if (!result.success) {
        errors[key] = z.flattenError(result.error)
        continue
      }
      if (hasNul(result.data)) {
        errors[key] = { formErrors: ['Text must not contain NUL characters'], fieldErrors: {} }
        continue
      }
      // Express 5 ทำ req.query เป็น getter จึงต้อง defineProperty แทนการ assign ตรง ๆ
      Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true, enumerable: true })
    }

    if (Object.keys(errors).length > 0) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request', errors))
    }
    next()
  }

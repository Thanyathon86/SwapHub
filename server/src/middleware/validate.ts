import type { RequestHandler } from 'express'
import { z } from 'zod'
import { AppError } from '../lib/errors.js'

type Schemas = {
  params?: z.ZodType
  query?: z.ZodType
  body?: z.ZodType
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
      // Express 5 ทำ req.query เป็น getter จึงต้อง defineProperty แทนการ assign ตรง ๆ
      Object.defineProperty(req, key, { value: result.data, writable: true, configurable: true, enumerable: true })
    }

    if (Object.keys(errors).length > 0) {
      return next(new AppError(400, 'VALIDATION_ERROR', 'Invalid request', errors))
    }
    next()
  }

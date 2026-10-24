import type { ErrorRequestHandler } from 'express'
import { AppError } from '../lib/errors.js'
import { logEvent } from '../lib/events.js'

// error จาก body-parser (http-errors) มี type บอกสาเหตุ
const bodyParserErrors: Record<string, { status: number; code: string; message: string }> = {
  'entity.parse.failed': { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON body' },
  'entity.too.large': { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' },
  'encoding.unsupported': { status: 415, code: 'UNSUPPORTED_ENCODING', message: 'Unsupported encoding' },
  'charset.unsupported': { status: 415, code: 'UNSUPPORTED_CHARSET', message: 'Unsupported charset' },
}

const getType = (err: unknown) =>
  typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string' ? err.type : undefined

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // ส่ง header ไปแล้วแก้ response ไม่ได้ ให้ Express ปิด connection เอง
  if (res.headersSent) return next(err)

  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) },
    })
    return
  }

  const known = bodyParserErrors[getType(err) ?? '']
  if (known) {
    res.status(known.status).json({ error: { code: known.code, message: known.message } })
    return
  }

  // error ที่ไม่ได้คาดไว้: log เต็มที่ server แต่ไม่ส่งรายละเอียดให้ client กันข้อมูลภายใน (stack, query, DB) หลุด
  console.error(err)
  // เก็บแค่ชื่อหรือรหัส error ไม่เก็บ message เพราะ error จาก DB อาจมีค่าจาก query ติดมา
  const code = typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string' ? err.code : undefined
  logEvent(req, { type: 'SERVER_ERROR', statusCode: 500, detail: code ?? (err instanceof Error ? err.name : 'Unknown') })
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } })
}

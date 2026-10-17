// error ที่ตั้งใจส่งให้ client เห็น ทุก module ใช้ตัวนี้เพื่อให้รูปแบบ response เหมือนกัน
export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

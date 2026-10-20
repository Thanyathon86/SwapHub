// รูปแบบ error ที่ server ส่งมา (ดู server/src/middleware/errorHandler.ts)
type ErrorBody = { error?: { code?: string; message?: string; details?: unknown } }

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

// แจ้ง AuthProvider เมื่อ session หมดอายุระหว่างใช้งาน จะได้พาไปหน้า login แทนที่จะค้างอยู่ในหน้าที่ใช้ไม่ได้
export const UNAUTHORIZED_EVENT = 'api:unauthorized'

type Options = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown }

export const api = async <T>(path: string, { method = 'GET', body }: Options = {}): Promise<T> => {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      // same-origin ผ่าน Vite proxy จึงไม่ต้องใช้ credentials: 'include' และ browser ส่ง Origin ให้เองซึ่ง server ใช้กัน CSRF
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Network error')
  }

  if (res.status === 204) return undefined as T

  const data: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = (data as ErrorBody | null)?.error
    if (res.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    throw new ApiError(res.status, err?.code ?? 'UNKNOWN', err?.message ?? 'Request failed', err?.details)
  }
  return data as T
}

const messages: Record<string, string> = {
  NETWORK_ERROR: 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง',
  INVALID_CREDENTIALS: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  EMAIL_TAKEN: 'อีเมลนี้ถูกใช้สมัครแล้ว',
  ACCOUNT_SUSPENDED: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแล',
  RATE_LIMITED: 'ลองหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
  VALIDATION_ERROR: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง',
  UNAUTHENTICATED: 'กรุณาเข้าสู่ระบบ',
  FORBIDDEN: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้',
  ALREADY_EXISTS: 'ชื่อหรือ slug นี้มีอยู่แล้ว',
  GAME_NOT_FOUND: 'ไม่พบเกมนี้ อาจถูกแก้ไขไปแล้ว ลองรีเฟรชหน้า',
  GRADING_COMPANY_NOT_FOUND: 'ไม่พบบริษัทเกรดนี้ อาจถูกแก้ไขไปแล้ว ลองรีเฟรชหน้า',
  USER_NOT_FOUND: 'ไม่พบผู้ใช้นี้',
  CANNOT_MODIFY_SELF: 'เปลี่ยนสถานะบัญชีของตัวเองไม่ได้',
  CANNOT_MODIFY_ADMIN: 'เปลี่ยนสถานะของ admin คนอื่นไม่ได้',
}

export const errorMessage = (err: unknown) =>
  (err instanceof ApiError && messages[err.code]) || 'เกิดข้อผิดพลาด กรุณาลองใหม่'

// ดึง error รายฟิลด์จาก VALIDATION_ERROR ของ body ไว้แสดงใต้ช่องกรอก
export const fieldErrors = (err: unknown): Record<string, string[] | undefined> => {
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_ERROR') return {}
  const details = err.details as { body?: { fieldErrors?: Record<string, string[]> } } | undefined
  return details?.body?.fieldErrors ?? {}
}

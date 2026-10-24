import { Router, type Request, type Response } from 'express'
import { authLimiter } from '../../middleware/rateLimit.js'
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js'
import { validate } from '../../middleware/validate.js'
import {
  createSession,
  deleteAllUserSessions,
  deleteSession,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../../lib/session.js'
import { AppError } from '../../lib/errors.js'
import { logEvent } from '../../lib/events.js'
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './auth.schema.js'
import * as authService from './auth.service.js'
import type { LoginPortal } from './auth.service.js'

export const authRouter = Router()

// สร้าง session ใหม่ทุกครั้งที่ login และลบอันเก่า กัน session fixation
const startSession = async (req: Request, res: Response, userId: string) => {
  const oldToken: unknown = req.cookies?.[SESSION_COOKIE]
  if (typeof oldToken === 'string' && oldToken) await deleteSession(oldToken)

  const { token, expiresAt } = await createSession(userId, { ip: req.ip, userAgent: req.get('user-agent') })
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(expiresAt))
}

authRouter.post('/register', authLimiter, validate({ body: registerSchema }), async (req, res) => {
  const user = await authService.register(req.body as RegisterInput)
  await startSession(req, res, user.id)
  logEvent(req, { type: 'REGISTER', userId: user.id })
  res.status(201).json({ user: authService.toPublicUser(user) })
})

const login = (portal: LoginPortal) => async (req: Request, res: Response) => {
  const input = req.body as LoginInput
  let user
  try {
    user = await authService.login(input, portal)
  } catch (err) {
    // บันทึกเฉพาะที่ระบบปฏิเสธการล็อกอิน error อื่นปล่อยให้ errorHandler บันทึกเป็น SERVER_ERROR
    if (err instanceof AppError) {
      logEvent(req, { type: 'LOGIN_FAILED', email: input.email, statusCode: err.status, detail: err.code })
    }
    throw err
  }
  await startSession(req, res, user.id)
  logEvent(req, { type: 'LOGIN_SUCCESS', userId: user.id, detail: portal })
  res.json({ user: authService.toPublicUser(user) })
}

authRouter.post('/login', authLimiter, validate({ body: loginSchema }), login('USER'))
authRouter.post('/admin/login', authLimiter, validate({ body: loginSchema }), login('ADMIN'))

// ไม่ต้อง requireAuth: session หมดอายุแล้วก็ควร logout ได้
authRouter.post('/logout', async (req, res) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE]
  if (typeof token === 'string' && token) {
    const userId = await deleteSession(token)
    if (userId) logEvent(req, { type: 'LOGOUT', userId })
  }
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions())
  res.status(204).end()
})

// ออกจากระบบทุกอุปกรณ์ ใช้เมื่อสงสัยว่าบัญชีถูกใช้จากที่อื่น
authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await deleteAllUserSessions(getAuthUser(req).id)
  logEvent(req, { type: 'LOGOUT', detail: 'ALL_DEVICES' })
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions())
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: getAuthUser(req) })
})

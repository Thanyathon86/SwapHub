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
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from './auth.schema.js'
import * as authService from './auth.service.js'

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
  res.status(201).json({ user: authService.toPublicUser(user) })
})

authRouter.post('/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
  const user = await authService.login(req.body as LoginInput)
  await startSession(req, res, user.id)
  res.json({ user: authService.toPublicUser(user) })
})

authRouter.post('/admin/login', authLimiter, validate({ body: loginSchema }), async (req, res) => {
  const user = await authService.login(req.body as LoginInput, 'ADMIN')
  await startSession(req, res, user.id)
  res.json({ user: authService.toPublicUser(user) })
})

// ไม่ต้อง requireAuth: session หมดอายุแล้วก็ควร logout ได้
authRouter.post('/logout', async (req, res) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE]
  if (typeof token === 'string' && token) await deleteSession(token)
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions())
  res.status(204).end()
})

// ออกจากระบบทุกอุปกรณ์ ใช้เมื่อสงสัยว่าบัญชีถูกใช้จากที่อื่น
authRouter.post('/logout-all', requireAuth, async (req, res) => {
  await deleteAllUserSessions(getAuthUser(req).id)
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions())
  res.status(204).end()
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: getAuthUser(req) })
})

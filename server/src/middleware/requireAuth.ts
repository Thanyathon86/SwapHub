import type { Request, RequestHandler } from 'express'
import { AppError } from '../lib/errors.js'
import { findValidSession, SESSION_COOKIE, sessionCookieOptions } from '../lib/session.js'

const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Authentication required')

export const requireAuth: RequestHandler = async (req, res, next) => {
  const token: unknown = req.cookies?.[SESSION_COOKIE]
  if (typeof token !== 'string' || token.length === 0) throw unauthenticated()

  const session = await findValidSession(token)
  // เช็ก status ทุก request เพื่อให้การระงับบัญชีมีผลทันที ไม่ต้องรอ session หมดอายุ
  if (!session || session.user.status !== 'ACTIVE') throw unauthenticated()

  // cookie ต้องหมดอายุพร้อม session ใน DB ไม่งั้น browser จะทิ้ง cookie ก่อนทั้งที่ session ยังใช้ได้
  if (session.renewed) res.cookie(SESSION_COOKIE, token, sessionCookieOptions(session.expiresAt))

  const { id, email, displayName, role } = session.user
  req.user = { id, email, displayName, role }
  req.sessionId = session.id
  next()
}

// ใช้ใน handler ที่อยู่หลัง requireAuth เพื่อให้ได้ type ที่ไม่เป็น undefined
export const getAuthUser = (req: Request) => {
  if (!req.user) throw unauthenticated()
  return req.user
}

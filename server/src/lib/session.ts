import { createHash, randomBytes } from 'node:crypto'
import type { CookieOptions } from 'express'
import { env } from '../config/env.js'
import { prisma } from './prisma.js'

const isProd = env.NODE_ENV === 'production'

// prefix __Host- บังคับให้ browser รับเฉพาะ cookie ที่ Secure + path=/ + ไม่มี domain แต่ใช้กับ http ตอน dev ไม่ได้
export const SESSION_COOKIE = isProd ? '__Host-sid' : 'sid'

const DAY_MS = 24 * 60 * 60 * 1000
const TTL_MS = env.SESSION_TTL_DAYS * DAY_MS
const ABSOLUTE_MS = env.SESSION_ABSOLUTE_DAYS * DAY_MS

export const sessionCookieOptions = (expires?: Date): CookieOptions => ({
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  ...(expires && { expires }),
})

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

type SessionMeta = { ip?: string | undefined; userAgent?: string | undefined }

export const createSession = async (userId: string, meta: SessionMeta) => {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + TTL_MS)
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
    },
  })
  return { token, expiresAt }
}

export const findValidSession = async (token: string) => {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (!session) return null

  const now = Date.now()
  if (session.expiresAt.getTime() <= now) {
    await prisma.session.deleteMany({ where: { id: session.id } })
    return null
  }

  // ต่ออายุเฉพาะเมื่อเหลือไม่ถึงครึ่ง จะได้ไม่ต้องเขียน DB ทุก request
  if (session.expiresAt.getTime() - now < TTL_MS / 2) {
    const next = Math.min(now + TTL_MS, session.createdAt.getTime() + ABSOLUTE_MS)
    if (next > session.expiresAt.getTime()) {
      const expiresAt = new Date(next)
      // updateMany ไม่ throw ถ้า session ถูกลบไปพร้อมกัน (เช่น logout จากอีกแท็บ)
      const { count } = await prisma.session.updateMany({ where: { id: session.id }, data: { expiresAt } })
      if (count === 0) return null
      return { ...session, expiresAt, renewed: true }
    }
  }
  return { ...session, renewed: false }
}

export const deleteExpiredSessions = () => prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } })

// คืน userId ของ session ที่ลบ ไว้ให้ log ว่าใคร logout (null ถ้าไม่มี session นี้อยู่แล้ว)
export const deleteSession = async (token: string) => {
  const where = { tokenHash: hashToken(token) }
  const session = await prisma.session.findUnique({ where, select: { userId: true } })
  // deleteMany ไม่ throw ถ้าถูกลบไปก่อนแล้ว (เช่น logout พร้อมกันสองแท็บ)
  if (session) await prisma.session.deleteMany({ where })
  return session?.userId ?? null
}

// ใช้ตอน admin ระงับผู้ใช้หรือผู้ใช้เปลี่ยนรหัสผ่าน เพื่อเตะออกทุกอุปกรณ์
export const deleteAllUserSessions = (userId: string) => prisma.session.deleteMany({ where: { userId } })

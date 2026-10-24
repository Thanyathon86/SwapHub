import type { Request } from 'express'
import type { EventType } from '../generated/prisma/enums.js'
import { env } from '../config/env.js'
import { prisma } from './prisma.js'

type EventInput = {
  type: EventType
  userId?: string | undefined
  email?: string | undefined
  statusCode?: number | undefined
  detail?: string | undefined
}

// ตัดความยาวกัน user agent หรือ path ยาวผิดปกติทำให้ DB บวม
const clip = (value: string | undefined, max: number) => value?.slice(0, max)

// ไม่ await และกลืน error เอง: ถ้าบันทึก log พลาด request ของผู้ใช้ต้องไม่ล้มตาม
export const logEvent = (req: Request, input: EventInput) => {
  prisma.eventLog
    .create({
      data: {
        ...input,
        userId: input.userId ?? req.user?.id,
        email: clip(input.email, 254),
        ip: req.ip,
        userAgent: clip(req.get('user-agent'), 300),
        method: req.method,
        // originalUrl มี query string ด้วย ตัดออกเผื่อมีข้อมูลที่ไม่ควรเก็บ
        path: clip(req.originalUrl.split('?')[0], 200),
        detail: clip(input.detail, 100),
      },
    })
    .catch((err: unknown) => console.error('Failed to write event log:', err))
}

// กันคนยิง request รัว ๆ แล้วทุก request ที่โดนบล็อกกลายเป็น log หนึ่งแถว
// บันทึกแค่ครั้งแรกของแต่ละ key ในช่วงเวลา แล้วเงียบจนกว่าจะหมดช่วง
const lastLogged = new Map<string, number>()

export const logEventThrottled = (key: string, windowMs: number, req: Request, input: EventInput) => {
  const now = Date.now()
  if ((lastLogged.get(key) ?? 0) > now - windowMs) return
  lastLogged.set(key, now)
  logEvent(req, input)
}

const DAY_MS = 24 * 60 * 60 * 1000

export const deleteOldEvents = () => {
  const now = Date.now()
  // ล้าง key เก่าใน Map ไปพร้อมกัน ไม่งั้น IP ที่ไม่กลับมาอีกจะค้างใน memory
  for (const [key, at] of lastLogged) if (at < now - DAY_MS) lastLogged.delete(key)
  return prisma.eventLog.deleteMany({ where: { createdAt: { lt: new Date(now - env.LOG_RETENTION_DAYS * DAY_MS) } } })
}

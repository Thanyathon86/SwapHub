import type { Response } from 'express'

// ส่งข้อความแบบทันทีด้วย Server-Sent Events ตัวเชื่อมต่ออยู่ใน memory จึงรองรับ server ตัวเดียว
// ถ้าขยายหลายตัวต้องส่งต่อผ่านตัวกลางอย่าง Redis ที่ไฟล์นี้ หน้าเว็บมีการดึงเป็นรอบสำรองอยู่แล้วถ้าการเชื่อมต่อหลุด

export type ChatEvent =
  | { type: 'message'; conversationId: string; message: unknown }
  | { type: 'read'; conversationId: string; readerId: string; readAt: string }

// กันแท็บเดียวเปิดซ้ำจนกิน connection ของ server หน้าเว็บปิดการเชื่อมต่อเองเมื่อแท็บถูกซ่อนอยู่แล้ว
const MAX_STREAMS_PER_USER = 5

const streams = new Map<string, Set<Response>>()

export const addStream = (userId: string, res: Response) => {
  const mine = streams.get(userId) ?? new Set<Response>()
  streams.set(userId, mine)
  if (mine.size >= MAX_STREAMS_PER_USER) {
    // ตัวเก่าสุดมักเป็นแท็บที่ลืมไว้ ปิดให้คนที่เพิ่งเปิดใช้ได้
    const oldest = mine.values().next().value
    if (oldest) {
      mine.delete(oldest)
      oldest.end()
    }
  }
  mine.add(res)
}

export const removeStream = (userId: string, res: Response) => {
  const mine = streams.get(userId)
  if (!mine) return
  mine.delete(res)
  if (mine.size === 0) streams.delete(userId)
}

export const publish = (userIds: string[], event: ChatEvent) => {
  const frame = `event: chat\ndata: ${JSON.stringify(event)}\n\n`
  for (const userId of userIds) {
    for (const res of streams.get(userId) ?? []) res.write(frame)
  }
}

// ระงับบัญชีต้องมีผลทันที ไม่รอรอบตรวจ session ของแต่ละการเชื่อมต่อ
export const closeStreamsOf = (userId: string) => {
  for (const res of streams.get(userId) ?? []) res.end()
  streams.delete(userId)
}

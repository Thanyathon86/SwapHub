import { randomUUID } from 'node:crypto'
import { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { processAvatar } from '../../lib/images.js'
import { prisma } from '../../lib/prisma.js'
import { removeFile, saveFile } from '../../lib/storage.js'
import { toPublicUser } from '../auth/auth.service.js'
import type { UpdateProfileInput } from './me.schema.js'

// นับเฉพาะเรื่องที่ผู้ใช้ต้องทำอะไรต่อ ยังไม่มีระบบ "อ่านแล้ว" จึงไม่นับสิ่งที่แค่เปลี่ยนสถานะ
export const getCounts = async (userId: string) => {
  const [incomingOffers, answeredTickets] = await Promise.all([
    prisma.offer.count({ where: { status: 'PENDING', listing: { sellerId: userId } } }),
    prisma.supportTicket.count({ where: { userId, status: 'ANSWERED' } }),
  ])
  return { incomingOffers, answeredTickets }
}

// ชื่อที่อาจทำให้คนเข้าใจผิดว่าเป็นทีมงาน กันทั้งชื่อตรง ๆ และชื่อที่มีคำเหล่านี้อยู่ข้างใน
const RESERVED_WORDS = ['admin', 'swaphub', 'support', 'staff', 'moderator', 'official']
const RESERVED_EXACT = new Set(['api', 'root', 'system', 'help', 'me', 'settings', 'profile', 'null', 'undefined'])

const isReserved = (username: string) =>
  RESERVED_EXACT.has(username) || RESERVED_WORDS.some((word) => username.includes(word))

export const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true } })
  // ชื่อสุ่มเดิมของบัญชีเก็บไว้ได้ ไม่ต้องผ่านกฎชื่อสงวนซ้ำ
  if (input.username !== current.username && isReserved(input.username)) {
    throw new AppError(400, 'USERNAME_RESERVED', 'This username is not available')
  }
  try {
    return toPublicUser(await prisma.user.update({ where: { id: userId }, data: input }))
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'USERNAME_TAKEN', 'This username is already taken')
    }
    throw err
  }
}

export const setAvatar = async (userId: string, file: Buffer) => {
  const data = await processAvatar(file)
  // ชื่อไฟล์ใหม่ทุกครั้ง browser ที่ cache รูปเก่าไว้จะไม่เห็นรูปเดิมค้าง
  const key = `avatars/${userId}/${randomUUID()}.webp`
  await saveFile(key, data)
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } })
  let user
  try {
    user = await prisma.user.update({ where: { id: userId }, data: { avatarKey: key } })
  } catch (err) {
    // บันทึก DB ไม่สำเร็จ ไฟล์ใหม่ไม่มีใครอ้างถึง ลบทิ้ง
    await removeFile(key)
    throw err
  }
  if (before.avatarKey) {
    await removeFile(before.avatarKey).catch((err: unknown) => console.error('Failed to remove old avatar:', err))
  }
  return toPublicUser(user)
}

export const removeAvatar = async (userId: string) => {
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } })
  const user = await prisma.user.update({ where: { id: userId }, data: { avatarKey: null } })
  if (before.avatarKey) {
    await removeFile(before.avatarKey).catch((err: unknown) => console.error('Failed to remove avatar:', err))
  }
  return toPublicUser(user)
}

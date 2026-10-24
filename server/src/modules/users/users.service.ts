import { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import { recordAudit } from '../audit/audit.service.js'
import type { ListUsersQuery, UpdateUserRoleInput, UpdateUserStatusInput } from './users.schema.js'

const PAGE_SIZE = 20

// ห้ามส่ง passwordHash ออกไป เลยระบุฟิลด์เองด้วย select
const adminUserSelect = {
  id: true,
  email: true,
  displayName: true,
  username: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect

const userNotFound = () => new AppError(404, 'USER_NOT_FOUND', 'User not found')
// กัน admin ระงับหรือถอดสิทธิ์ตัวเอง ทำให้มี admin เหลืออย่างน้อยหนึ่งคนเสมอ
const cannotModifySelf = () => new AppError(400, 'CANNOT_MODIFY_SELF', 'Cannot change your own account')

export const listUsers = async ({ q, status, role, page }: ListUsersQuery) => {
  const where: Prisma.UserWhereInput = {
    ...(status && { status }),
    ...(role && { role }),
    ...(q && {
      OR: [
        { email: { contains: q, mode: 'insensitive' } },
        { displayName: { contains: q, mode: 'insensitive' } },
      ],
    }),
  }
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: adminUserSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ])
  return { users, total, page, pageSize: PAGE_SIZE }
}

export const setUserStatus = async (actorId: string, userId: string, { status }: UpdateUserStatusInput) => {
  if (actorId === userId) throw cannotModifySelf()

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, status: true } })
  if (!target) throw userNotFound()
  // ระงับ admin ตรง ๆ ไม่ได้ ต้องถอดสิทธิ์ก่อน จะได้มี log การถอดสิทธิ์แยกให้เห็นชัด
  if (target.role === 'ADMIN') throw new AppError(403, 'CANNOT_MODIFY_ADMIN', 'Cannot change another admin')

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { status }, select: adminUserSelect })
    // requireAuth เช็ก status ทุก request อยู่แล้ว ลบ session ด้วยอีกชั้นเผื่อมีโค้ดที่ลืมเช็ก
    if (status === 'SUSPENDED') await tx.session.deleteMany({ where: { userId } })
    // กดซ้ำสถานะเดิมไม่ต้องลง log ให้ประวัติมีแต่การเปลี่ยนจริง
    if (target.status !== status) {
      await recordAudit(tx, {
        actorId,
        targetUserId: userId,
        action: status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      })
    }
    return user
  })
}

export const setUserRole = async (actorId: string, userId: string, { role }: UpdateUserRoleInput) => {
  if (actorId === userId) throw cannotModifySelf()

  try {
    // Serializable: ถ้า admin สองคนถอดสิทธิ์กันเองพร้อมกัน DB จะยกเลิกหนึ่ง transaction ไม่ให้ระบบเหลือ admin ศูนย์คน
    return await prisma.$transaction(
      async (tx) => {
        // อ่านแถวของผู้กดใน transaction ด้วย ไม่งั้น DB จะไม่รู้ว่าสอง transaction ขัดกัน
        const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, status: true } })
        if (actor?.role !== 'ADMIN' || actor.status !== 'ACTIVE') {
          throw new AppError(403, 'FORBIDDEN', 'Insufficient permissions')
        }

        const target = await tx.user.findUnique({ where: { id: userId }, select: { role: true, status: true } })
        if (!target) throw userNotFound()
        if (target.role === role) throw new AppError(409, 'ROLE_UNCHANGED', 'User already has this role')
        if (role === 'ADMIN' && target.status !== 'ACTIVE') {
          throw new AppError(400, 'USER_NOT_ACTIVE', 'Only active users can be promoted')
        }

        const user = await tx.user.update({ where: { id: userId }, data: { role }, select: adminUserSelect })
        // แต่ละ role ล็อกอินคนละหน้า เตะออกทุกอุปกรณ์ให้ไปล็อกอินใหม่ที่หน้าที่ถูกต้อง
        await tx.session.deleteMany({ where: { userId } })
        await recordAudit(tx, {
          actorId,
          targetUserId: userId,
          action: role === 'ADMIN' ? 'USER_PROMOTED' : 'USER_DEMOTED',
        })
        return user
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      throw new AppError(409, 'CONCURRENT_UPDATE', 'Another change happened at the same time, please retry')
    }
    throw err
  }
}

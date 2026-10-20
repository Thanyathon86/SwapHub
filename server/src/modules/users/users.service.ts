import type { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import type { ListUsersQuery, UpdateUserStatusInput } from './users.schema.js'

const PAGE_SIZE = 20

// ห้ามส่ง passwordHash ออกไป เลยระบุฟิลด์เองด้วย select
const adminUserSelect = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect

export const listUsers = async ({ q, status, page }: ListUsersQuery) => {
  const where: Prisma.UserWhereInput = {
    ...(status && { status }),
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
  // กัน admin ระงับตัวเองจนเข้าหลังบ้านไม่ได้
  if (actorId === userId) throw new AppError(400, 'CANNOT_MODIFY_SELF', 'Cannot change your own status')

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
  if (!target) throw new AppError(404, 'USER_NOT_FOUND', 'User not found')
  // admin ระงับกันเองไม่ได้ กัน admin คนเดียวยึดระบบ ต้องแก้ผ่าน DB แทน
  if (target.role === 'ADMIN') throw new AppError(403, 'CANNOT_MODIFY_ADMIN', 'Cannot change another admin')

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id: userId }, data: { status }, select: adminUserSelect })
    // requireAuth เช็ก status ทุก request อยู่แล้ว ลบ session ด้วยอีกชั้นเผื่อมีโค้ดที่ลืมเช็ก
    if (status === 'SUSPENDED') await tx.session.deleteMany({ where: { userId } })
    return user
  })
}

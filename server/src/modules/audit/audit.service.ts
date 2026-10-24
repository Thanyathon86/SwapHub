import type { Prisma } from '../../generated/prisma/client.js'
import type { AuditAction } from '../../generated/prisma/enums.js'
import { prisma } from '../../lib/prisma.js'
import type { ListAuditLogsQuery } from './audit.schema.js'

const PAGE_SIZE = 50

// รับ tx เพื่อให้ log ถูกบันทึกพร้อมกับการเปลี่ยนแปลงจริง ถ้าอย่างใดล้มเหลวจะ rollback ทั้งคู่
export const recordAudit = (
  db: Prisma.TransactionClient,
  entry: { actorId: string; action: AuditAction; targetUserId: string },
) => db.auditLog.create({ data: entry })

const party = { select: { id: true, displayName: true, email: true } } satisfies Prisma.UserDefaultArgs

export const listAuditLogs = async ({ page }: ListAuditLogsQuery) => {
  const [logs, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      include: { actor: party, targetUser: party },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ])
  return { logs, total, page, pageSize: PAGE_SIZE }
}

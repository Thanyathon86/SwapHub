import { z } from 'zod'
import { AuditAction } from '../../generated/prisma/enums.js'

export const listAuditLogsQuery = z.strictObject({
  // การอนุมัติประกาศมีจำนวนมาก ต้องกรองได้ ไม่งั้นการเปลี่ยนสิทธิ์ที่นาน ๆ เกิดทีจะหาไม่เจอ
  action: z.enum(AuditAction).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuery>

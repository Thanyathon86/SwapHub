import { z } from 'zod'

export const listAuditLogsQuery = z.strictObject({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuery>

import { z } from 'zod'
import { EscrowStatus } from '../../generated/prisma/enums.js'

const reason = z.string().trim().min(1).max(1000)

export const escrowIdParams = z.strictObject({ id: z.uuid() })

export const shipEscrowSchema = z.strictObject({
  carrier: z.string().trim().min(1).max(60),
  trackingNumber: z.string().trim().min(1).max(60),
})

export const disputeEscrowSchema = z.strictObject({ reason })

export const adminEscrowsQuery = z.strictObject({
  status: z.enum(EscrowStatus).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export const resolveEscrowSchema = z.strictObject({
  decision: z.enum(['RELEASE', 'REFUND']),
  reason,
})

export type EscrowIdParams = z.infer<typeof escrowIdParams>
export type ShipEscrowInput = z.infer<typeof shipEscrowSchema>
export type DisputeEscrowInput = z.infer<typeof disputeEscrowSchema>
export type AdminEscrowsQuery = z.infer<typeof adminEscrowsQuery>
export type ResolveEscrowInput = z.infer<typeof resolveEscrowSchema>

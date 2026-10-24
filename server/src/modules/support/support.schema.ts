import { z } from 'zod'
import { TicketCategory, TicketStatus } from '../../generated/prisma/enums.js'

const text = (max: number) => z.string().trim().min(1).max(max)

export const createTicketSchema = z.strictObject({
  subject: text(120),
  category: z.enum(TicketCategory),
  body: text(2000),
})

export const ticketMessageSchema = z.strictObject({ body: text(2000) })

export const ticketIdParams = z.strictObject({ id: z.uuid() })

export const adminTicketsQuery = z.strictObject({
  status: z.enum(TicketStatus).default('OPEN'),
  category: z.enum(TicketCategory).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export type CreateTicketInput = z.infer<typeof createTicketSchema>
export type TicketMessageInput = z.infer<typeof ticketMessageSchema>
export type TicketIdParams = z.infer<typeof ticketIdParams>
export type AdminTicketsQuery = z.infer<typeof adminTicketsQuery>

import { z } from 'zod'
import { EventType } from '../../generated/prisma/enums.js'

export const listEventsQuery = z.strictObject({
  type: z.enum(EventType).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export type ListEventsQuery = z.infer<typeof listEventsQuery>

import type { Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../../lib/prisma.js'
import type { ListEventsQuery } from './events.schema.js'

const PAGE_SIZE = 50

export const listEvents = async ({ type, page }: ListEventsQuery) => {
  const where: Prisma.EventLogWhereInput = { ...(type && { type }) }
  const [events, total] = await prisma.$transaction([
    prisma.eventLog.findMany({
      where,
      include: { user: { select: { id: true, displayName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.eventLog.count({ where }),
  ])
  return { events, total, page, pageSize: PAGE_SIZE }
}

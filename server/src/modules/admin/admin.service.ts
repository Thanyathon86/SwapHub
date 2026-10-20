import { prisma } from '../../lib/prisma.js'

export const getStats = async () => {
  const [users, suspendedUsers, activeGames, pendingListings, activeListings] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.game.count({ where: { isActive: true } }),
    prisma.listing.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.listing.count({ where: { status: 'ACTIVE' } }),
  ])
  return { users, suspendedUsers, activeGames, pendingListings, activeListings }
}

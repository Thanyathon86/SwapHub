import { Prisma } from '../../generated/prisma/client.js'
import { prisma } from '../../lib/prisma.js'

const DAY_MS = 24 * 60 * 60 * 1000
const CHART_DAYS = 30
// ผู้ใช้และ admin อยู่ไทย นับ "วัน" ตามเวลาไทย ไม่งั้นกิจกรรมช่วงเช้ามืดจะไปตกวันก่อนหน้า
const TIME_ZONE = 'Asia/Bangkok'

type DailyRow = { day: string; n: number }

// วันที่แบบ YYYY-MM-DD ตามเวลาไทย (en-CA ให้รูปแบบนี้พอดี)
const dayKey = (date: Date) => date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE })

const lastDays = (count: number) =>
  Array.from({ length: count }, (_, i) => dayKey(new Date(Date.now() - (count - 1 - i) * DAY_MS)))

export const getDashboard = async () => {
  const now = Date.now()
  const since24h = new Date(now - DAY_MS)
  const since7d = new Date(now - 7 * DAY_MS)
  // ดึงย้อนเกินมาหนึ่งวันแล้วค่อยกรองตาม key ของวัน กันขอบวันตามเวลาไทยหลุด
  const chartSince = new Date(now - (CHART_DAYS + 1) * DAY_MS)

  // table และ column เป็นค่าคงที่ในโค้ด ไม่ได้มาจาก request จึงใช้ Prisma.raw ได้ ส่วนค่าอื่นยังเป็น parameter
  // Prisma เก็บ DateTime เป็น UTC แบบไม่มี timezone จึงต้องบอกว่าเป็น UTC ก่อนแปลงเป็นเวลาไทย
  const daily = (table: string, column: string, extra: Prisma.Sql = Prisma.empty) => {
    const col = Prisma.raw(`"${column}"`)
    return prisma.$queryRaw<DailyRow[]>`
      SELECT to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}, 'YYYY-MM-DD') AS day, count(*)::int AS n
      FROM ${Prisma.raw(`"${table}"`)} WHERE ${col} >= ${chartSince} ${extra} GROUP BY 1`
  }

  const [
    users,
    newUsers7d,
    suspendedUsers,
    activeListings,
    pendingListings,
    pendingListingsOver24h,
    pendingOffers,
    openTickets,
    deals7d,
    games,
    securityCounts,
    recentAudit,
    userRows,
    listingRows,
    dealRows,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.listing.count({ where: { status: 'ACTIVE' } }),
    prisma.listing.count({ where: { status: 'PENDING_REVIEW' } }),
    prisma.listing.count({ where: { status: 'PENDING_REVIEW', createdAt: { lt: since24h } } }),
    prisma.offer.count({ where: { status: 'PENDING' } }),
    prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    prisma.offer.count({ where: { status: 'ACCEPTED', respondedAt: { gte: since7d } } }),
    prisma.game.findMany({
      select: { id: true, name: true, isActive: true, _count: { select: { listings: { where: { status: 'ACTIVE' } } } } },
    }),
    prisma.eventLog.groupBy({
      by: ['type'],
      where: { createdAt: { gte: since24h }, type: { in: ['LOGIN_FAILED', 'RATE_LIMITED', 'ACCESS_DENIED', 'SERVER_ERROR'] } },
      _count: { _all: true },
    }),
    prisma.auditLog.findMany({
      include: {
        actor: { select: { id: true, displayName: true } },
        targetUser: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    daily('User', 'createdAt'),
    daily('Listing', 'createdAt'),
    // ดีล = offer ที่ตอบรับ นับตามวันที่ตอบรับ ไม่ใช่วันที่ส่ง
    daily('Offer', 'respondedAt', Prisma.sql`AND status = 'ACCEPTED'`),
  ])

  const byDay = (rows: DailyRow[]) => new Map(rows.map((r) => [r.day, r.n]))
  const [u, l, d] = [byDay(userRows), byDay(listingRows), byDay(dealRows)]
  const security = Object.fromEntries(securityCounts.map((row) => [row.type, row._count._all]))

  return {
    attention: { pendingListings, pendingListingsOver24h, pendingOffers, openTickets },
    totals: { users, newUsers7d, suspendedUsers, activeListings, deals7d },
    daily: lastDays(CHART_DAYS).map((day) => ({
      day,
      users: u.get(day) ?? 0,
      listings: l.get(day) ?? 0,
      deals: d.get(day) ?? 0,
    })),
    listingsByGame: games
      .map((g) => ({ id: g.id, name: g.name, isActive: g.isActive, activeListings: g._count.listings }))
      .sort((a, b) => b.activeListings - a.activeListings),
    security24h: {
      loginFailed: security.LOGIN_FAILED ?? 0,
      rateLimited: security.RATE_LIMITED ?? 0,
      accessDenied: security.ACCESS_DENIED ?? 0,
      serverErrors: security.SERVER_ERROR ?? 0,
    },
    recentAudit,
  }
}

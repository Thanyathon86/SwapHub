import type { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import { recordAudit } from '../audit/audit.service.js'
import type { AdminReviewsQuery, RemoveReviewInput, ReviewInput, ReviewsQuery } from './reviews.schema.js'
import { reviewOpen } from '../escrow/escrow.service.js'

// เขียนหรือแก้รีวิวได้ภายในช่วงนี้หลังตอบรับ ให้เวลาส่งของและตรวจของก่อน แล้วล็อกไว้ไม่ให้แก้ย้อนหลังไปเรื่อย ๆ
export const REVIEW_WINDOW_MS = 30 * 24 * 60 * 60 * 1000
const PAGE_SIZE = 20

export type RatingSummary = { average: number | null; count: number }

// คะแนนเฉลี่ยของหลายคนในครั้งเดียว ใช้กับรายการข้อเสนอที่มีหลายคน ไม่ต้อง query ทีละคน
export const ratingSummaries = async (userIds: string[]) => {
  const ids = [...new Set(userIds)]
  const rows =
    ids.length === 0
      ? []
      : await prisma.review.groupBy({
          by: ['revieweeId'],
          where: { revieweeId: { in: ids }, removedAt: null },
          _avg: { rating: true },
          _count: { _all: true },
        })
  const map = new Map<string, RatingSummary>(ids.map((id) => [id, { average: null, count: 0 }]))
  for (const row of rows) {
    // ปัดทศนิยมตำแหน่งเดียวแบบที่ร้านค้าออนไลน์แสดง (4.8)
    const average = row._avg.rating === null ? null : Math.round(row._avg.rating * 10) / 10
    map.set(row.revieweeId, { average, count: row._count._all })
  }
  return map
}

export const ratingOf = async (userId: string) =>
  (await ratingSummaries([userId])).get(userId) ?? { average: null, count: 0 }

const offerNotFound = () => new AppError(404, 'OFFER_NOT_FOUND', 'Offer not found')

export const upsertReview = async (reviewerId: string, offerId: string, input: ReviewInput) => {
  const offer = await prisma.offer.findUnique({
    where: { id: offerId },
    select: {
      status: true,
      respondedAt: true,
      buyerId: true,
      listing: { select: { sellerId: true } },
      escrow: { select: { status: true, settledAt: true } },
    },
  })
  const sellerId = offer?.listing.sellerId
  // คนนอกดีลได้ 404 เหมือนไม่มีข้อเสนอนี้ ไม่บอกว่ามีอยู่
  if (!offer || (offer.buyerId !== reviewerId && sellerId !== reviewerId)) throw offerNotFound()
  if (offer.status !== 'ACCEPTED' || !offer.respondedAt) {
    throw new AppError(409, 'OFFER_NOT_ACCEPTED', 'Only accepted deals can be reviewed')
  }
  if (!reviewOpen(offer.escrow)) throw new AppError(409, 'ESCROW_NOT_SETTLED', 'Reviews open once the escrow is settled')
  // ดีลผ่าน escrow อาจใช้เวลาหลายวัน จึงนับจากวันที่เงินจบ ไม่งั้นเวลารีวิวจะถูกกินไปกับการรอของ
  if (Date.now() - (offer.escrow?.settledAt ?? offer.respondedAt).getTime() > REVIEW_WINDOW_MS) {
    throw new AppError(409, 'REVIEW_WINDOW_CLOSED', 'Reviews can only be written or edited within 30 days of the deal')
  }

  // ผู้รับรีวิวคืออีกฝั่งของดีลเสมอ ไม่รับจาก client
  const revieweeId = offer.buyerId === reviewerId ? sellerId! : offer.buyerId
  const existing = await prisma.review.findUnique({
    where: { offerId_reviewerId: { offerId, reviewerId } },
    select: { removedAt: true },
  })
  // ถ้าให้แก้ได้ คนเขียนจะเอาข้อความเดิมกลับมาลงใหม่หลังทีมงานซ่อน
  if (existing?.removedAt) throw new AppError(409, 'REVIEW_REMOVED', 'This review was removed by staff')
  return prisma.review.upsert({
    where: { offerId_reviewerId: { offerId, reviewerId } },
    create: { offerId, reviewerId, revieweeId, ...input },
    update: input,
    select: { id: true, rating: true, comment: true, createdAt: true, updatedAt: true },
  })
}

export const listReviewsFor = async (revieweeId: string, { page }: ReviewsQuery) => {
  const where = { revieweeId, removedAt: null }
  const [reviews, total] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        updatedAt: true,
        reviewer: { select: { username: true, displayName: true, avatarKey: true } },
        // บอกว่ารีวิวนี้มาจากดีลแบบไหน คนอ่านจะได้รู้บริบท
        offer: { select: { buyerId: true, listing: { select: { title: true } } } },
        reviewerId: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.review.count({ where }),
  ])
  return {
    reviews: reviews.map(({ offer, reviewerId, ...review }) => ({
      ...review,
      // มุมของคนเขียน: ซื้อ/ขอแลกจากเจ้าของโปรไฟล์ หรือเป็นผู้ขายที่ขายให้เจ้าของโปรไฟล์
      reviewerRole: offer.buyerId === reviewerId ? 'BUYER' : 'SELLER',
      listingTitle: offer.listing.title,
    })),
    total,
    page,
    pageSize: PAGE_SIZE,
  }
}

const adminParty = { select: { id: true, username: true, displayName: true, email: true } } satisfies Prisma.UserDefaultArgs

export const listReviewsForAdmin = async ({ q, status, page }: AdminReviewsQuery) => {
  const username = q?.toLowerCase()
  const where: Prisma.ReviewWhereInput = {
    removedAt: status === 'REMOVED' ? { not: null } : null,
    ...(username && { OR: [{ reviewer: { username } }, { reviewee: { username } }] }),
  }
  const [reviews, total] = await prisma.$transaction([
    prisma.review.findMany({
      where,
      include: {
        reviewer: adminParty,
        reviewee: adminParty,
        removedBy: { select: { id: true, displayName: true } },
        offer: { select: { id: true, listing: { select: { id: true, title: true } } } },
      },
      // รายการที่ซ่อนแล้วเรียงตามเวลาที่ซ่อน ใช้ตรวจย้อนหลัง
      orderBy: status === 'REMOVED' ? { removedAt: 'desc' } : { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.review.count({ where }),
  ])
  return { reviews, total, page, pageSize: PAGE_SIZE }
}

export const removeReview = (actorId: string, id: string, { reason }: RemoveReviewInput) =>
  prisma.$transaction(async (tx) => {
    // updateMany พร้อมเงื่อนไข removedAt: null กัน admin สองคนกดพร้อมกันแล้วได้ audit log ซ้ำ
    const { count } = await tx.review.updateMany({
      where: { id, removedAt: null },
      data: { removedAt: new Date(), removedById: actorId, removeReason: reason },
    })
    if (count === 0) {
      const exists = await tx.review.count({ where: { id } })
      if (!exists) throw new AppError(404, 'REVIEW_NOT_FOUND', 'Review not found')
      throw new AppError(409, 'REVIEW_ALREADY_REMOVED', 'Review has already been removed')
    }
    const review = await tx.review.findUniqueOrThrow({ where: { id } })
    await recordAudit(tx, { actorId, action: 'REVIEW_REMOVED', targetUserId: review.reviewerId, detail: reason })
    return review
  })

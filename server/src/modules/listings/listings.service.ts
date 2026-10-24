import type { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import { cancelPendingOffers } from '../offers/cancelPendingOffers.js'
import type {
  AdminListingsQuery,
  BrowseListingsQuery,
  CreateListingInput,
  ReviewListingInput,
} from './listings.schema.js'

const PAGE_SIZE = 24

export const listingInclude = {
  game: { select: { id: true, name: true, slug: true } },
  gradingCompany: { select: { id: true, name: true } },
  // ผู้ใช้ทั่วไปเห็นแค่ชื่อที่แสดงของผู้ขาย ไม่ส่งอีเมลออกไป
  seller: { select: { id: true, displayName: true } },
} satisfies Prisma.ListingInclude

// ไม่บอกคนทั่วไปว่า admin คนไหนตรวจประกาศ
export const publicOmit = { reviewedById: true } satisfies Prisma.ListingOmit

// ประกาศที่คนทั่วไปเห็นได้: ผ่านการตรวจแล้ว และเกมกับผู้ขายยังไม่ถูกปิด
export const publicWhere = {
  status: 'ACTIVE',
  game: { isActive: true },
  seller: { status: 'ACTIVE' },
} satisfies Prisma.ListingWhereInput

const notFound = () => new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found')

// ประกาศแบบ BOTH ต้องโผล่ทั้งตอนกรองหาของขายและของแลก
const typeFilter = { SALE: ['SALE', 'BOTH'], TRADE: ['TRADE', 'BOTH'], BOTH: ['BOTH'] } as const

const sortOrder: Record<BrowseListingsQuery['sort'], Prisma.ListingOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }],
  // ประกาศแลกอย่างเดียวไม่มีราคา ให้ไปอยู่ท้ายสุดทั้งสองทิศ
  price_asc: [{ price: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  price_desc: [{ price: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
}

export const browseListings = async ({ q, game, itemKind, type, sort, page }: BrowseListingsQuery) => {
  const where: Prisma.ListingWhereInput = {
    ...publicWhere,
    ...(game && { game: { ...publicWhere.game, slug: game } }),
    ...(itemKind && { itemKind }),
    ...(type && { type: { in: [...typeFilter[type]] } }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { setName: { contains: q, mode: 'insensitive' } },
        { cardNumber: { contains: q, mode: 'insensitive' } },
      ],
    }),
  }
  const [listings, total] = await prisma.$transaction([
    prisma.listing.findMany({
      where,
      include: listingInclude,
      omit: publicOmit,
      orderBy: sortOrder[sort],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.listing.count({ where }),
  ])
  return { listings, total, page, pageSize: PAGE_SIZE }
}

export const getListing = async (id: string) => {
  const listing = await prisma.listing.findFirst({
    where: { ...publicWhere, id },
    include: listingInclude,
    omit: publicOmit,
  })
  if (!listing) throw notFound()
  return listing
}

export const createListing = async (sellerId: string, input: CreateListingInput) => {
  const game = await prisma.game.findUnique({ where: { id: input.gameId }, select: { isActive: true } })
  if (!game?.isActive) throw new AppError(400, 'INVALID_GAME', 'Game not found or inactive')

  if (input.itemKind === 'GRADED') {
    const company = await prisma.gradingCompany.findUnique({
      where: { id: input.gradingCompanyId },
      select: { isActive: true },
    })
    if (!company?.isActive) {
      throw new AppError(400, 'INVALID_GRADING_COMPANY', 'Grading company not found or inactive')
    }
  }

  // ทุกประกาศใหม่ต้องรอ admin ตรวจก่อน status ไม่รับจาก client
  return prisma.listing.create({ data: { ...input, sellerId }, include: listingInclude, omit: publicOmit })
}

// ยังไม่แบ่งหน้า ผู้ขายหนึ่งคนไม่น่ามีประกาศเยอะขนาดนั้นในช่วงแรก
export const listMyListings = (sellerId: string) =>
  prisma.listing.findMany({
    where: { sellerId },
    include: listingInclude,
    omit: publicOmit,
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

export const closeListing = (sellerId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    // เช็กเงื่อนไข status ใน where เดียวกับ update กันกรณี admin ตรวจประกาศพร้อมกับที่ผู้ขายกดปิด
    const { count } = await tx.listing.updateMany({
      where: { id, sellerId, status: { in: ['PENDING_REVIEW', 'ACTIVE'] } },
      data: { status: 'CLOSED' },
    })
    if (count === 0) {
      const exists = await tx.listing.count({ where: { id, sellerId } })
      if (!exists) throw notFound()
      throw new AppError(409, 'LISTING_NOT_CLOSABLE', 'Listing is already closed or rejected')
    }
    await cancelPendingOffers(tx, [id])
    return tx.listing.findUniqueOrThrow({ where: { id }, include: listingInclude, omit: publicOmit })
  })

// admin ต้องเห็นอีเมลผู้ขายไว้ติดต่อ และเห็นว่าใครเป็นคนตรวจ
const adminInclude = {
  ...listingInclude,
  seller: { select: { id: true, displayName: true, email: true } },
  reviewedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.ListingInclude

export const listForReview = async ({ status, page }: AdminListingsQuery) => {
  const where: Prisma.ListingWhereInput = { status }
  const [listings, total] = await prisma.$transaction([
    prisma.listing.findMany({
      where,
      include: adminInclude,
      // คิวรอตรวจให้อันที่รอนานสุดขึ้นก่อน สถานะอื่นดูอันล่าสุดก่อน
      orderBy: { createdAt: status === 'PENDING_REVIEW' ? 'asc' : 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.listing.count({ where }),
  ])
  return { listings, total, page, pageSize: PAGE_SIZE }
}

export const reviewListing = async (adminId: string, id: string, input: ReviewListingInput) => {
  const approved = input.decision === 'APPROVE'
  // where มี status กัน admin สองคนตรวจประกาศเดียวกันพร้อมกันแล้วผลทับกัน
  const { count } = await prisma.listing.updateMany({
    where: { id, status: 'PENDING_REVIEW' },
    data: {
      status: approved ? 'ACTIVE' : 'REJECTED',
      rejectReason: approved ? null : input.reason,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  })
  if (count === 0) {
    const exists = await prisma.listing.count({ where: { id } })
    if (!exists) throw notFound()
    throw new AppError(409, 'LISTING_ALREADY_REVIEWED', 'Listing has already been reviewed')
  }
  return prisma.listing.findUniqueOrThrow({ where: { id }, include: adminInclude })
}

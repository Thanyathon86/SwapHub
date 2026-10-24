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

// เกมและบริษัทเกรดที่ admin ปิดไปแล้วห้ามใช้ ทั้งตอนสร้างและตอนแก้
const assertCatalog = async (db: Prisma.TransactionClient, input: CreateListingInput) => {
  const game = await db.game.findUnique({ where: { id: input.gameId }, select: { isActive: true } })
  if (!game?.isActive) throw new AppError(400, 'INVALID_GAME', 'Game not found or inactive')

  if (input.itemKind === 'GRADED') {
    const company = await db.gradingCompany.findUnique({
      where: { id: input.gradingCompanyId },
      select: { isActive: true },
    })
    if (!company?.isActive) {
      throw new AppError(400, 'INVALID_GRADING_COMPANY', 'Grading company not found or inactive')
    }
  }
}

export const createListing = async (sellerId: string, input: CreateListingInput) => {
  await assertCatalog(prisma, input)

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

export const getMyListing = async (sellerId: string, id: string) => {
  const listing = await prisma.listing.findFirst({ where: { id, sellerId }, include: listingInclude, omit: publicOmit })
  if (!listing) throw notFound()
  return listing
}

// ฟิลด์ที่บอกว่าเป็นการ์ดใบไหน แก้แล้วต้องให้ admin ตรวจใหม่ กันผู้ขายเปลี่ยนเป็นการ์ดอื่นหลังผ่านการตรวจ
const IDENTITY_FIELDS = [
  'gameId',
  'title',
  'setName',
  'language',
  'cardNumber',
  'rarity',
  'condition',
  'gradingCompanyId',
  'grade',
  'certNumber',
] as const

// เทียบค่าเป็นสตริง เพราะ grade ใน DB เป็น Decimal แต่ input เป็น number (9.5 กับ Decimal("9.5"))
const same = (a: unknown, b: unknown) => (a == null ? null : String(a)) === (b == null ? null : String(b))

// แปลง input เป็นข้อมูลที่จะเขียนทับทั้งหมด ฟิลด์ไม่บังคับที่ผู้ขายลบออกต้องเป็น null ไม่ใช่ undefined
// (undefined ใน Prisma แปลว่า "ไม่แก้" ค่าเดิมจะค้างอยู่)
const toListingData = (input: CreateListingInput) => ({
  gameId: input.gameId,
  type: input.type,
  title: input.title,
  setName: input.setName,
  language: input.language,
  price: input.price ?? null,
  description: input.description ?? null,
  cardNumber: input.itemKind === 'SEALED' ? null : (input.cardNumber ?? null),
  rarity: input.itemKind === 'SEALED' ? null : (input.rarity ?? null),
  condition: input.itemKind === 'SINGLE' ? input.condition : null,
  gradingCompanyId: input.itemKind === 'GRADED' ? input.gradingCompanyId : null,
  grade: input.itemKind === 'GRADED' ? input.grade : null,
  certNumber: input.itemKind === 'GRADED' ? input.certNumber : null,
  quantity: input.itemKind === 'GRADED' ? 1 : input.quantity,
})

export const updateListing = (sellerId: string, id: string, input: CreateListingInput) =>
  prisma.$transaction(async (tx) => {
    const current = await tx.listing.findFirst({ where: { id, sellerId } })
    if (!current) throw notFound()
    if (current.status === 'CLOSED') throw new AppError(409, 'LISTING_NOT_EDITABLE', 'Closed listings cannot be edited')
    // แต่ละ itemKind มีชุดฟิลด์ต่างกัน เปลี่ยนแล้วข้อมูลเดิมไม่สอดคล้อง ให้ลงประกาศใหม่แทน
    if (current.itemKind !== input.itemKind) {
      throw new AppError(400, 'ITEM_KIND_IMMUTABLE', 'Item kind cannot be changed')
    }
    await assertCatalog(tx, input)

    const data = toListingData(input)
    const identityChanged = IDENTITY_FIELDS.some((field) => !same(current[field], data[field]))
    // ประกาศที่ไม่ผ่านแก้แล้วถือว่าส่งตรวจใหม่ ส่วนประกาศที่เปิดอยู่ต้องตรวจใหม่เฉพาะตอนเปลี่ยนตัวการ์ด
    const backToReview = current.status === 'REJECTED' || (current.status === 'ACTIVE' && identityChanged)

    // เช็ก status ใน where กันกรณี admin ตรวจประกาศพร้อมกับที่ผู้ขายกดบันทึก
    const { count } = await tx.listing.updateMany({
      where: { id, status: current.status },
      data: {
        ...data,
        ...(backToReview && { status: 'PENDING_REVIEW', rejectReason: null, reviewedById: null, reviewedAt: null }),
      },
    })
    if (count === 0) throw new AppError(409, 'LISTING_CHANGED', 'Listing was changed by someone else, please reload')

    if (backToReview && current.status === 'ACTIVE') {
      // ผู้ซื้อเสนอมาบนการ์ดใบเดิม ข้อเสนอเก่าจึงใช้ไม่ได้แล้ว
      await cancelPendingOffers(tx, [id])
    } else if (data.type !== current.type) {
      // เปลี่ยนแบบประกาศแล้ว ยกเลิกเฉพาะข้อเสนอที่ไม่เข้ากับแบบใหม่
      const incompatible: Prisma.OfferWhereInput[] = []
      if (data.type === 'SALE') incompatible.push({ items: { some: {} } })
      if (data.type === 'TRADE') incompatible.push({ items: { none: {} } })
      if (incompatible.length > 0) {
        await tx.offer.updateMany({
          where: { listingId: id, status: 'PENDING', OR: incompatible },
          data: { status: 'CANCELLED', respondedAt: new Date() },
        })
      }
    }

    return tx.listing.findUniqueOrThrow({ where: { id }, include: listingInclude, omit: publicOmit })
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

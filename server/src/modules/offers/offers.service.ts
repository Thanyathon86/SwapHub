import type { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import { listingInclude, publicOmit, publicWhere } from '../listings/listings.service.js'
import { cancelPendingOffers } from './cancelPendingOffers.js'
import type { CreateOfferInput } from './offers.schema.js'

// ดึงอีเมลมาด้วยแต่จะส่งออกไปเฉพาะ offer ที่ตอบรับแล้ว (ดู toView)
const contactUser = { select: { id: true, displayName: true, email: true } } satisfies Prisma.UserDefaultArgs

const offerInclude = {
  listing: { include: { ...listingInclude, seller: contactUser }, omit: publicOmit },
  buyer: contactUser,
  items: { include: { listing: { include: listingInclude, omit: publicOmit } } },
} satisfies Prisma.OfferInclude

type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerInclude }>

// ยังไม่มีแชท ให้ทั้งสองฝ่ายเห็นอีเมลกันหลังตกลงแล้วเท่านั้น ก่อนหน้านั้นใครก็ส่ง offer มาเพื่อเก็บอีเมลไม่ได้
const toView = (offer: OfferRow) => {
  const accepted = offer.status === 'ACCEPTED'
  return {
    ...offer,
    buyer: { ...offer.buyer, email: accepted ? offer.buyer.email : null },
    listing: {
      ...offer.listing,
      seller: { ...offer.listing.seller, email: accepted ? offer.listing.seller.email : null },
    },
  }
}

const notFound = () => new AppError(404, 'OFFER_NOT_FOUND', 'Offer not found')
const noLongerValid = () =>
  new AppError(409, 'OFFER_NO_LONGER_VALID', 'Listings in this offer are no longer available in that quantity')

// ยังไม่แบ่งหน้าเหมือน listMyListings
const LIST_LIMIT = 100

export const createOffer = async (buyerId: string, input: CreateOfferInput) => {
  const target = await prisma.listing.findFirst({
    where: { ...publicWhere, id: input.listingId },
    select: { sellerId: true, type: true, quantity: true },
  })
  if (!target) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found')
  if (target.sellerId === buyerId) throw new AppError(400, 'CANNOT_OFFER_OWN_LISTING', 'Cannot offer on own listing')

  const hasItems = input.items.length > 0
  if (hasItems && target.type === 'SALE') {
    throw new AppError(400, 'LISTING_NOT_TRADEABLE', 'This listing does not accept trades')
  }
  // ประกาศแลกอย่างเดียวรับเงินเพิ่มได้ แต่ต้องมีของมาแลกด้วย
  if (!hasItems && target.type === 'TRADE') {
    throw new AppError(400, 'LISTING_TRADE_ONLY', 'This listing only accepts trades')
  }
  if (input.quantity > target.quantity) {
    throw new AppError(400, 'INSUFFICIENT_QUANTITY', 'Requested quantity exceeds what is available')
  }

  if (hasItems) {
    const owned = await prisma.listing.findMany({
      where: { id: { in: input.items.map((i) => i.listingId) }, sellerId: buyerId, status: 'ACTIVE' },
      select: { id: true, quantity: true },
    })
    const stock = new Map(owned.map((l) => [l.id, l.quantity]))
    for (const item of input.items) {
      const available = stock.get(item.listingId)
      if (available === undefined) {
        throw new AppError(400, 'INVALID_OFFER_ITEMS', 'Trade items must be your own active listings')
      }
      if (item.quantity > available) {
        throw new AppError(400, 'INSUFFICIENT_QUANTITY', 'Trade item quantity exceeds what is available')
      }
    }
  }

  // ไม่ได้กัน race ด้วย unique index ถ้ากดส่งพร้อมกันจริงจะได้ offer ซ้ำ ซึ่งแค่ซ้ำซ้อนไม่ได้ทำให้ข้อมูลผิด
  const pending = await prisma.offer.count({ where: { listingId: input.listingId, buyerId, status: 'PENDING' } })
  if (pending > 0) throw new AppError(409, 'OFFER_ALREADY_PENDING', 'You already have a pending offer on this listing')

  const offer = await prisma.offer.create({
    data: {
      listingId: input.listingId,
      buyerId,
      quantity: input.quantity,
      cashAmount: input.cashAmount,
      message: input.message,
      items: { create: input.items },
    },
    include: offerInclude,
  })
  return toView(offer)
}

export const listIncoming = async (sellerId: string) =>
  (
    await prisma.offer.findMany({
      where: { listing: { sellerId } },
      include: offerInclude,
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    })
  ).map(toView)

export const listOutgoing = async (buyerId: string) =>
  (
    await prisma.offer.findMany({
      where: { buyerId },
      include: offerInclude,
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    })
  ).map(toView)

// where ของแต่ละการกระทำบอกว่าใครมีสิทธิ์ทำกับ offer นั้น
const sellerOf = (sellerId: string) => ({ listing: { sellerId } }) satisfies Prisma.OfferWhereInput
const buyerOf = (buyerId: string) => ({ buyerId }) satisfies Prisma.OfferWhereInput

// เช็ก status ใน where เดียวกับ update กันสองฝ่ายกดพร้อมกัน เช่น ผู้ขอยกเลิกตอนที่ผู้ขายกดปฏิเสธ
const markPending = async (
  db: Prisma.TransactionClient,
  id: string,
  owner: Prisma.OfferWhereInput,
  status: 'ACCEPTED' | 'DECLINED' | 'CANCELLED',
) => {
  const { count } = await db.offer.updateMany({
    where: { ...owner, id, status: 'PENDING' },
    data: { status, respondedAt: new Date() },
  })
  if (count === 0) {
    const exists = await db.offer.count({ where: { ...owner, id } })
    if (!exists) throw notFound()
    throw new AppError(409, 'OFFER_NOT_PENDING', 'Offer has already been responded to')
  }
}

export const declineOffer = async (sellerId: string, id: string) => {
  await markPending(prisma, id, sellerOf(sellerId), 'DECLINED')
  return toView(await prisma.offer.findUniqueOrThrow({ where: { id }, include: offerInclude }))
}

export const cancelOffer = async (buyerId: string, id: string) => {
  await markPending(prisma, id, buyerOf(buyerId), 'CANCELLED')
  return toView(await prisma.offer.findUniqueOrThrow({ where: { id }, include: offerInclude }))
}

export const acceptOffer = (sellerId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    await markPending(tx, id, sellerOf(sellerId), 'ACCEPTED')
    const offer = await tx.offer.findUniqueOrThrow({ where: { id }, include: { items: true } })

    // ตัดสต็อกทั้งฝั่งผู้ขายและของที่ผู้ขอเอามาแลก
    const takes = [
      { listingId: offer.listingId, sellerId, quantity: offer.quantity },
      ...offer.items.map((i) => ({ listingId: i.listingId, sellerId: offer.buyerId, quantity: i.quantity })),
    ]
    for (const take of takes) {
      // เงื่อนไข quantity อยู่ใน where เดียวกับ decrement กันสต็อกติดลบเมื่อตอบรับสอง offer พร้อมกัน
      // ถ้าไม่ผ่าน throw แล้ว transaction จะ rollback รวมถึง status ACCEPTED ด้วย
      const { count } = await tx.listing.updateMany({
        where: { id: take.listingId, sellerId: take.sellerId, status: 'ACTIVE', quantity: { gte: take.quantity } },
        data: { quantity: { decrement: take.quantity } },
      })
      if (count === 0) throw noLongerValid()
    }

    const soldOut = await tx.listing.findMany({
      where: { id: { in: takes.map((t) => t.listingId) }, quantity: 0 },
      select: { id: true },
    })
    if (soldOut.length > 0) {
      const ids = soldOut.map((l) => l.id)
      await tx.listing.updateMany({ where: { id: { in: ids } }, data: { status: 'CLOSED' } })
      await cancelPendingOffers(tx, ids)
    }

    return toView(await tx.offer.findUniqueOrThrow({ where: { id }, include: offerInclude }))
  })

import type { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import { listingInclude, publicOmit, publicWhere } from '../listings/listings.service.js'
import { ratingSummaries, REVIEW_WINDOW_MS, type RatingSummary } from '../reviews/reviews.service.js'
import { cancelPendingOffers } from './cancelPendingOffers.js'
import type { CreateOfferInput, OfferMessageInput } from './offers.schema.js'

// ดึงอีเมลมาด้วยแต่จะส่งออกไปเฉพาะ offer ที่ตอบรับแล้ว (ดู toView)
const contactUser = {
  select: { id: true, displayName: true, username: true, avatarKey: true, email: true },
} satisfies Prisma.UserDefaultArgs

const offerInclude = {
  listing: { include: { ...listingInclude, seller: contactUser }, omit: publicOmit },
  buyer: contactUser,
  items: { include: { listing: { include: listingInclude, omit: publicOmit } } },
  reviews: { select: { reviewerId: true, rating: true, comment: true, updatedAt: true, removedAt: true } },
  // หน้ารายการแสดงแค่จำนวน ข้อความจริงดึงตอนเปิดแชท
  _count: { select: { messages: true } },
} satisfies Prisma.OfferInclude

type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerInclude }>

// ให้ทั้งสองฝ่ายเห็นอีเมลกันหลังตกลงแล้วเท่านั้น ก่อนหน้านั้นใครก็ส่ง offer มาเพื่อเก็บอีเมลไม่ได้ (ก่อนตกลงคุยผ่านแชทในระบบ)
// แนบคะแนนของทั้งสองฝ่าย ผู้ขายใช้ดูก่อนตัดสินใจตอบรับว่าคนที่ขอมาเชื่อถือได้ไหม
const noRating: RatingSummary = { average: null, count: 0 }

const toView = (offer: OfferRow, ratings: Map<string, RatingSummary>) => {
  const accepted = offer.status === 'ACCEPTED'
  return {
    ...offer,
    buyer: { ...offer.buyer, email: accepted ? offer.buyer.email : null, rating: ratings.get(offer.buyer.id) ?? noRating },
    listing: {
      ...offer.listing,
      seller: {
        ...offer.listing.seller,
        email: accepted ? offer.listing.seller.email : null,
        rating: ratings.get(offer.listing.seller.id) ?? noRating,
      },
    },
    // รีวิวที่ทีมงานซ่อนส่งไปแค่ว่าถูกซ่อน ไม่ส่งคะแนนและข้อความเดิม
    reviews: offer.reviews.map((r) => (r.removedAt ? { ...r, rating: null, comment: null } : r)),
    // หน้าเว็บใช้ซ่อนปุ่มให้คะแนนเมื่อเลยกำหนด (server ตรวจซ้ำอีกที)
    reviewDeadline: accepted && offer.respondedAt ? new Date(offer.respondedAt.getTime() + REVIEW_WINDOW_MS) : null,
  }
}

// ดึงคะแนนของทุกคนในรายการทีเดียว ไม่ query ทีละ offer
const toViews = async (offers: OfferRow[]) => {
  const ratings = await ratingSummaries(offers.flatMap((o) => [o.buyer.id, o.listing.seller.id]))
  return offers.map((o) => toView(o, ratings))
}

const toViewOne = async (offer: OfferRow) => (await toViews([offer]))[0]!

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
  return toViewOne(offer)
}

export const listIncoming = async (sellerId: string) =>
  toViews(
    await prisma.offer.findMany({
      where: { listing: { sellerId } },
      include: offerInclude,
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    }),
  )

export const listOutgoing = async (buyerId: string) =>
  toViews(
    await prisma.offer.findMany({
      where: { buyerId },
      include: offerInclude,
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    }),
  )

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
  return toViewOne(await prisma.offer.findUniqueOrThrow({ where: { id }, include: offerInclude }))
}

export const cancelOffer = async (buyerId: string, id: string) => {
  await markPending(prisma, id, buyerOf(buyerId), 'CANCELLED')
  return toViewOne(await prisma.offer.findUniqueOrThrow({ where: { id }, include: offerInclude }))
}

export const acceptOffer = (sellerId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    await markPending(tx, id, sellerOf(sellerId), 'ACCEPTED')
    const offer = await tx.offer.findUniqueOrThrow({
      where: { id },
      include: { items: true, buyer: { select: { status: true } } },
    })
    // ระงับบัญชีจะยกเลิกข้อเสนอที่ค้างให้แล้ว ส่วนนี้กันข้อเสนอที่ค้างมาก่อนหน้านั้น และการระงับที่เกิดพร้อมกับการกดตอบรับ
    if (offer.buyer.status !== 'ACTIVE') {
      throw new AppError(409, 'OFFER_PARTY_UNAVAILABLE', 'The other party can no longer complete this deal')
    }

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

    return tx.offer.findUniqueOrThrow({ where: { id }, include: offerInclude })
  }).then(toViewOne)

// ข้อความเก่ากว่านี้ไม่ส่งไป แชทต่อหนึ่งดีลไม่น่ายาวเกินนี้ และกัน response ใหญ่จน polling ช้า
const MESSAGE_LIMIT = 200
// คุยต่อได้เฉพาะดีลที่ยังไม่จบหรือตกลงกันแล้ว (ต้องนัดส่งของ) ดีลที่ปฏิเสธหรือยกเลิกเหลือไว้อ่านอย่างเดียว
const CHAT_OPEN = new Set(['PENDING', 'ACCEPTED'])

const partyOf = (userId: string) =>
  ({ OR: [{ buyerId: userId }, { listing: { sellerId: userId } }] }) satisfies Prisma.OfferWhereInput

// คนนอกดีลได้ 404 เหมือนไม่มีข้อเสนอนี้
const findAsParty = async (userId: string, id: string) => {
  const offer = await prisma.offer.findFirst({ where: { id, ...partyOf(userId) }, select: { id: true, status: true } })
  if (!offer) throw notFound()
  return offer
}

const messageSelect = { id: true, authorId: true, body: true, createdAt: true } satisfies Prisma.OfferMessageSelect

export const listMessages = async (userId: string, id: string) => {
  const offer = await findAsParty(userId, id)
  const latest = await prisma.offerMessage.findMany({
    where: { offerId: id },
    select: messageSelect,
    orderBy: { createdAt: 'desc' },
    take: MESSAGE_LIMIT,
  })
  return { messages: latest.reverse(), canSend: CHAT_OPEN.has(offer.status) }
}

export const sendMessage = async (userId: string, id: string, { body }: OfferMessageInput) => {
  const offer = await findAsParty(userId, id)
  if (!CHAT_OPEN.has(offer.status)) {
    throw new AppError(409, 'OFFER_CHAT_CLOSED', 'This offer was declined or cancelled, chat is read-only')
  }
  return prisma.offerMessage.create({ data: { offerId: id, authorId: userId, body }, select: messageSelect })
}

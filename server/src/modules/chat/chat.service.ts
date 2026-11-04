import { randomUUID } from 'node:crypto'
import { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { processImage } from '../../lib/images.js'
import { prisma } from '../../lib/prisma.js'
import { readPrivateFile, removePrivateFile, savePrivateFile } from '../../lib/storage.js'
import { listingInclude, publicOmit, publicWhere } from '../listings/listings.service.js'
import { publish } from './chatEvents.js'
import { toMessage } from './chatMessages.js'
import type { MessagesQuery, OpenConversationInput, SendMessageInput } from './chat.schema.js'

const INBOX_LIMIT = 100
const PAGE_SIZE = 50

const notFound = () => new AppError(404, 'CHAT_NOT_FOUND', 'Conversation not found')

const partyUser = { select: { id: true, displayName: true, username: true, avatarKey: true, status: true } } satisfies Prisma.UserDefaultArgs

const conversationInclude = {
  listing: { include: listingInclude, omit: publicOmit },
  buyer: partyUser,
  seller: partyUser,
  // ข้อความล่าสุดไว้แสดงในกล่องข้อความ
  messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1 },
} satisfies Prisma.ConversationInclude

type ConversationRow = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>
type MessageRow = Prisma.ChatMessageGetPayload<object>

type Blocks = { blockerId: string; blockedId: string }[]

const blocksBetween = (userId: string, otherIds: string[]): Promise<Blocks> =>
  prisma.chatBlock.findMany({
    where: {
      OR: [
        { blockerId: userId, blockedId: { in: otherIds } },
        { blockedId: userId, blockerId: { in: otherIds } },
      ],
    },
    select: { blockerId: true, blockedId: true },
  })

// นับเฉพาะข้อความจากอีกฝ่ายที่ใหม่กว่าเวลาที่เราอ่านล่าสุด เงื่อนไขต่อห้องต่างกันจึงเขียน Prisma ธรรมดาไม่ได้
const unreadRows = (userId: string, conversationIds?: string[]) => {
  const only = conversationIds ? Prisma.sql`AND c."id" = ANY(${conversationIds}::uuid[])` : Prisma.empty
  return prisma.$queryRaw<{ id: string; n: number }[]>`
    SELECT c."id", count(m."id")::int AS n
    FROM "Conversation" c
    JOIN "ChatMessage" m ON m."conversationId" = c."id"
    WHERE (c."buyerId" = ${userId}::uuid OR c."sellerId" = ${userId}::uuid)
      AND m."authorId" <> ${userId}::uuid
      AND m."createdAt" > COALESCE(CASE WHEN c."buyerId" = ${userId}::uuid THEN c."buyerLastReadAt" ELSE c."sellerLastReadAt" END, '-infinity'::timestamp)
      ${only}
    GROUP BY c."id"`
}

export const countUnread = async (userId: string) => (await unreadRows(userId)).reduce((sum, row) => sum + row.n, 0)

const toView = (c: ConversationRow, userId: string, unread: number, blocks: Blocks) => {
  const isBuyer = c.buyerId === userId
  const other = isBuyer ? c.seller : c.buyer
  const blockedByMe = blocks.some((b) => b.blockerId === userId && b.blockedId === other.id)
  const blockedByOther = blocks.some((b) => b.blockerId === other.id && b.blockedId === userId)
  const last = c.messages[0]
  const { status: otherStatus, ...otherPublic } = other
  return {
    id: c.id,
    role: isBuyer ? ('BUYER' as const) : ('SELLER' as const),
    listing: c.listing,
    other: otherPublic,
    lastMessage: last ? toMessage(last) : null,
    lastMessageAt: c.lastMessageAt,
    unread,
    otherLastReadAt: isBuyer ? c.sellerLastReadAt : c.buyerLastReadAt,
    // ไม่บอกเหตุผลว่าอีกฝ่ายบล็อกหรือถูกระงับ คนนั้นจะได้ไม่รู้สถานะของอีกฝ่าย
    canSend: !blockedByMe && !blockedByOther && otherStatus === 'ACTIVE',
    blockedByMe,
  }
}

export const listConversations = async (userId: string) => {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ buyerId: userId }, { sellerId: userId }], lastMessageAt: { not: null } },
    include: conversationInclude,
    orderBy: { lastMessageAt: 'desc' },
    take: INBOX_LIMIT,
  })
  const ids = rows.map((r) => r.id)
  const [unread, blocks] = await Promise.all([
    ids.length > 0 ? unreadRows(userId, ids) : [],
    blocksBetween(userId, rows.map((r) => (r.buyerId === userId ? r.sellerId : r.buyerId))),
  ])
  const unreadOf = new Map(unread.map((u) => [u.id, u.n]))
  return rows.map((r) => toView(r, userId, unreadOf.get(r.id) ?? 0, blocks))
}

const findAsParty = async (userId: string, id: string) => {
  const conversation = await prisma.conversation.findFirst({
    where: { id, OR: [{ buyerId: userId }, { sellerId: userId }] },
    include: conversationInclude,
  })
  // คนนอกห้องได้ 404 เหมือนไม่มีห้องนี้
  if (!conversation) throw notFound()
  return conversation
}

export const getConversation = async (userId: string, id: string) => {
  const row = await findAsParty(userId, id)
  const otherId = row.buyerId === userId ? row.sellerId : row.buyerId
  const [unread, blocks, latestOffer] = await Promise.all([
    unreadRows(userId, [id]),
    blocksBetween(userId, [otherId]),
    // ลิงก์จากหัวห้องไปข้อเสนอล่าสุดของคู่นี้
    prisma.offer.findFirst({
      where: { listingId: row.listingId, buyerId: row.buyerId },
      select: { id: true, status: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])
  return { ...toView(row, userId, unread[0]?.n ?? 0, blocks), latestOffer }
}

// กดเปิดซ้ำได้ห้องเดิม upsert พร้อมกันยังชน unique ได้ คนที่แพ้ใช้ห้องที่อีกคนเพิ่งสร้าง
const upsertRoom = async (listingId: string, buyerId: string, sellerId: string) => {
  const where = { listingId_buyerId: { listingId, buyerId } }
  try {
    return await prisma.conversation.upsert({
      where,
      create: { listingId, buyerId, sellerId },
      update: {},
      select: { id: true },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return prisma.conversation.findUniqueOrThrow({ where, select: { id: true } })
    }
    throw err
  }
}

export const openConversation = async (userId: string, input: OpenConversationInput) => {
  if ('offerId' in input) {
    const offer = await prisma.offer.findFirst({
      where: { id: input.offerId, OR: [{ buyerId: userId }, { listing: { sellerId: userId } }] },
      select: { listingId: true, buyerId: true, listing: { select: { sellerId: true } } },
    })
    if (!offer) throw new AppError(404, 'OFFER_NOT_FOUND', 'Offer not found')
    const room = await upsertRoom(offer.listingId, offer.buyerId, offer.listing.sellerId)
    return getConversation(userId, room.id)
  }

  const existing = await prisma.conversation.findUnique({
    where: { listingId_buyerId: { listingId: input.listingId, buyerId: userId } },
    select: { id: true },
  })
  // ห้องเดิมเปิดต่อได้แม้ประกาศปิดแล้ว ห้องใหม่เปิดได้เฉพาะประกาศที่ยังอยู่ในตลาด
  if (existing) return getConversation(userId, existing.id)
  const listing = await prisma.listing.findFirst({
    where: { ...publicWhere, id: input.listingId },
    select: { sellerId: true },
  })
  if (!listing) throw new AppError(404, 'LISTING_NOT_FOUND', 'Listing not found')
  if (listing.sellerId === userId) throw new AppError(400, 'CHAT_OWN_LISTING', 'Cannot chat with yourself')
  const room = await upsertRoom(input.listingId, userId, listing.sellerId)
  return getConversation(userId, room.id)
}

export const listMessages = async (userId: string, id: string, { before }: MessagesQuery) => {
  await findAsParty(userId, id)
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId: id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE + 1,
    ...(before && { cursor: { id: before }, skip: 1 }),
  })
  const hasMore = rows.length > PAGE_SIZE
  return { messages: rows.slice(0, PAGE_SIZE).reverse().map(toMessage), hasMore }
}

const assertCanSend = async (userId: string, id: string) => {
  const room = await findAsParty(userId, id)
  const otherId = room.buyerId === userId ? room.sellerId : room.buyerId
  const other = room.buyerId === userId ? room.seller : room.buyer
  const blocks = await blocksBetween(userId, [otherId])
  if (blocks.length > 0 || other.status !== 'ACTIVE') {
    throw new AppError(409, 'CHAT_UNAVAILABLE', 'Messages cannot be sent in this conversation')
  }
  return room
}

// ขยับเวลาห้องพร้อมกับเขียนข้อความ และนับว่าคนส่งอ่านถึงข้อความของตัวเองแล้ว
const addMessage = async (userId: string, room: { id: string; buyerId: string }, data: Partial<MessageRow>) => {
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.chatMessage.create({ data: { ...data, conversationId: room.id, authorId: userId } })
    await tx.conversation.update({
      where: { id: room.id },
      data: {
        lastMessageAt: created.createdAt,
        ...(room.buyerId === userId ? { buyerLastReadAt: created.createdAt } : { sellerLastReadAt: created.createdAt }),
      },
    })
    return created
  })
  return toMessage(message)
}

const announce = (room: { id: string; buyerId: string; sellerId: string }, message: ReturnType<typeof toMessage>) =>
  // ส่งให้คนส่งด้วย แท็บอื่นของเขาจะได้เห็นข้อความเดียวกัน
  publish([room.buyerId, room.sellerId], { type: 'message', conversationId: room.id, message })

export const sendMessage = async (userId: string, id: string, { body }: SendMessageInput) => {
  const room = await assertCanSend(userId, id)
  const message = await addMessage(userId, room, { body })
  announce(room, message)
  return message
}

export const sendImage = async (userId: string, id: string, file: Buffer) => {
  const room = await assertCanSend(userId, id)
  const { data, width, height } = await processImage(file)
  const key = `chat/${id}/${randomUUID()}.webp`
  await savePrivateFile(key, data)
  try {
    const message = await addMessage(userId, room, { imageKey: key, imageWidth: width, imageHeight: height })
    announce(room, message)
    return message
  } catch (err) {
    // เขียน DB ไม่สำเร็จ ไฟล์จะไม่มีแถวไหนอ้างถึงอีก
    await removePrivateFile(key).catch(() => undefined)
    throw err
  }
}

export const readImage = async (userId: string, messageId: string) => {
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      imageKey: { not: null },
      conversation: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    },
    select: { imageKey: true },
  })
  if (!message?.imageKey) throw notFound()
  return readPrivateFile(message.imageKey)
}

export const markRead = async (userId: string, id: string) => {
  const room = await findAsParty(userId, id)
  const latest = room.messages[0]
  if (!latest) return
  // ใช้เวลาของข้อความล่าสุด ไม่ใช่เวลาปัจจุบัน ข้อความที่เข้ามาระหว่างนี้จะได้ยังนับเป็นยังไม่อ่าน
  const isBuyer = room.buyerId === userId
  const { count } = await prisma.conversation.updateMany({
    where: {
      id,
      ...(isBuyer
        ? { OR: [{ buyerLastReadAt: null }, { buyerLastReadAt: { lt: latest.createdAt } }] }
        : { OR: [{ sellerLastReadAt: null }, { sellerLastReadAt: { lt: latest.createdAt } }] }),
    },
    data: isBuyer ? { buyerLastReadAt: latest.createdAt } : { sellerLastReadAt: latest.createdAt },
  })
  if (count > 0) {
    publish([room.buyerId, room.sellerId], {
      type: 'read',
      conversationId: id,
      readerId: userId,
      readAt: latest.createdAt.toISOString(),
    })
  }
}

export const blockOther = async (userId: string, id: string) => {
  const room = await findAsParty(userId, id)
  const blockedId = room.buyerId === userId ? room.sellerId : room.buyerId
  await prisma.chatBlock.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId } },
    create: { blockerId: userId, blockedId },
    update: {},
  })
  return getConversation(userId, id)
}

export const unblockOther = async (userId: string, id: string) => {
  const room = await findAsParty(userId, id)
  const blockedId = room.buyerId === userId ? room.sellerId : room.buyerId
  await prisma.chatBlock.deleteMany({ where: { blockerId: userId, blockedId } })
  return getConversation(userId, id)
}

import type { Prisma } from '../../generated/prisma/client.js'
import type { EscrowEventType, EscrowStatus } from '../../generated/prisma/enums.js'
import { AppError } from '../../lib/errors.js'
import { payments } from '../../lib/payments.js'
import { prisma } from '../../lib/prisma.js'
import { recordAudit } from '../audit/audit.service.js'
import { listDealMessages, readDealImage } from '../chat/chatMessages.js'
import type { AdminEscrowsQuery, DisputeEscrowInput, ResolveEscrowInput, ShipEscrowInput } from './escrow.schema.js'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const PAYMENT_WINDOW_MS = 48 * HOUR_MS
const SHIP_WINDOW_MS = 5 * DAY_MS
const CONFIRM_WINDOW_MS = 7 * DAY_MS
const PAGE_SIZE = 30

// เงินยังอยู่กลาง admin เข้าไปตัดสินได้
const HOLDING: EscrowStatus[] = ['HELD', 'SHIPPED', 'DISPUTED']
const SETTLED_WITH_MONEY = new Set<EscrowStatus>(['RELEASED', 'REFUNDED'])

type Tx = Prisma.TransactionClient

const notFound = () => new AppError(404, 'ESCROW_NOT_FOUND', 'Escrow not found')
const invalidState = () => new AppError(409, 'ESCROW_INVALID_STATE', 'This escrow can no longer do that')
const wrongParty = () => new AppError(403, 'ESCROW_WRONG_PARTY', 'The other party has to do this')

const log = (tx: Tx, escrowId: string, type: EscrowEventType, status: EscrowStatus, actorId: string | null, note?: string) =>
  tx.escrowEvent.create({ data: { escrowId, type, status, actorId, note } })

// เช็กเงื่อนไขใน where เดียวกับ update กันสองฝ่ายกดพร้อมกัน และกันงานกวาดชนกับการกดของผู้ใช้
// updateMany ยังล็อกแถวไว้จนจบ transaction คนที่มาทีหลังจึงอ่านเห็นค่าล่าสุดเสมอ
const claim = async (tx: Tx, id: string, where: Prisma.EscrowWhereInput, data: Prisma.EscrowUncheckedUpdateManyInput) => {
  const { count } = await tx.escrow.updateMany({ where: { ...where, id }, data })
  if (count === 0) throw invalidState()
}

const withOffer = {
  offer: { select: { listingId: true, quantity: true, items: { select: { listingId: true, quantity: true } } } },
} satisfies Prisma.EscrowInclude

const restock = async (tx: Tx, listingId: string, quantity: number) => {
  // ประกาศที่ปิดเพราะของหมดมี quantity 0 ส่วนที่เจ้าของปิดเองยังมีจำนวนเหลือ จึงไม่ถูกเปิดกลับ
  await tx.listing.updateMany({ where: { id: listingId, status: 'CLOSED', quantity: 0 }, data: { status: 'ACTIVE' } })
  await tx.listing.update({ where: { id: listingId }, data: { quantity: { increment: quantity } } })
}

// คืนสต็อกเฉพาะฝั่งที่ยังไม่ได้ส่ง ฝั่งที่ส่งแล้วของอาจยังไม่กลับมา เจ้าของต้องลงขายใหม่เอง
const restockUnshipped = async (tx: Tx, escrow: Prisma.EscrowGetPayload<{ include: typeof withOffer }>) => {
  if (!escrow.sellerShippedAt) await restock(tx, escrow.offer.listingId, escrow.offer.quantity)
  if (!escrow.buyerShippedAt) {
    for (const item of escrow.offer.items) await restock(tx, item.listingId, item.quantity)
  }
  // ยังไม่มีใครส่งของ ถือว่าดีลไม่เกิด ซ่อนอีเมล ปิดแชท และไม่ให้รีวิวกันผ่านสถานะ offer
  if (!escrow.sellerShippedAt && !escrow.buyerShippedAt) {
    await tx.offer.update({ where: { id: escrow.offerId }, data: { status: 'CANCELLED' } })
  }
}

// ยังไม่มีเงินเข้า ปิดได้เลย ไม่ต้องคืนเงิน
const voidUnpaid = async (tx: Tx, id: string, status: 'CANCELLED' | 'EXPIRED', actorId: string | null, note: string) => {
  await claim(tx, id, { status: 'AWAITING_PAYMENT' }, { status, settledAt: new Date(), resolutionNote: note })
  const escrow = await tx.escrow.findUniqueOrThrow({ where: { id }, include: withOffer })
  await restockUnshipped(tx, escrow)
  await log(tx, id, status, status, actorId, note)
}

type Settlement = { actorId: string | null; note?: string; resolvedById?: string }

const refund = async (tx: Tx, id: string, where: Prisma.EscrowWhereInput, { actorId, note, resolvedById }: Settlement) => {
  await claim(tx, id, where, { status: 'REFUNDED', settledAt: new Date(), resolutionNote: note, resolvedById })
  const escrow = await tx.escrow.findUniqueOrThrow({ where: { id }, include: withOffer })
  const { reference } = await payments.refund({ escrowId: id, amount: escrow.amount })
  await tx.escrow.update({ where: { id }, data: { refundRef: reference } })
  await restockUnshipped(tx, escrow)
  await log(tx, id, 'REFUNDED', 'REFUNDED', actorId, note)
}

const release = async (tx: Tx, id: string, where: Prisma.EscrowWhereInput, { actorId, note, resolvedById }: Settlement) => {
  await claim(tx, id, where, { status: 'RELEASED', settledAt: new Date(), resolutionNote: note, resolvedById })
  const { amount } = await tx.escrow.findUniqueOrThrow({ where: { id }, select: { amount: true } })
  const { reference } = await payments.payout({ escrowId: id, amount })
  await tx.escrow.update({ where: { id }, data: { payoutRef: reference } })
  await log(tx, id, 'RELEASED', 'RELEASED', actorId, note)
}

const dispute = async (tx: Tx, id: string, where: Prisma.EscrowWhereInput, actorId: string | null, reason: string) => {
  await claim(tx, id, where, { status: 'DISPUTED', disputedAt: new Date(), disputedById: actorId, disputeReason: reason })
  await log(tx, id, 'DISPUTED', 'DISPUTED', actorId, reason)
}

// ---- มุมมองของคู่ดีล ----

export const partyEscrowInclude = { events: { orderBy: { createdAt: 'asc' } } } satisfies Prisma.EscrowInclude
type PartyEscrowRow = Prisma.EscrowGetPayload<{ include: typeof partyEscrowInclude }>

// ไม่ส่ง id ของทีมงานและเลขอ้างอิงการเงิน ฝั่งผู้ใช้เห็นทีมงานเป็นชื่อกลางเหมือนเรื่องที่แจ้ง
export const toPartyEscrow = (e: PartyEscrowRow) => {
  const roleOf = (userId: string | null) =>
    userId === null ? 'SYSTEM' : userId === e.buyerId ? 'BUYER' : userId === e.sellerId ? 'SELLER' : 'STAFF'
  return {
    id: e.id,
    offerId: e.offerId,
    amount: e.amount,
    twoWay: e.twoWay,
    status: e.status,
    paymentDueAt: e.paymentDueAt,
    shipDueAt: e.shipDueAt,
    confirmDueAt: e.confirmDueAt,
    paidAt: e.paidAt,
    sellerCarrier: e.sellerCarrier,
    sellerTrackingNumber: e.sellerTrackingNumber,
    sellerShippedAt: e.sellerShippedAt,
    buyerCarrier: e.buyerCarrier,
    buyerTrackingNumber: e.buyerTrackingNumber,
    buyerShippedAt: e.buyerShippedAt,
    buyerReceivedAt: e.buyerReceivedAt,
    sellerReceivedAt: e.sellerReceivedAt,
    disputedAt: e.disputedAt,
    disputeReason: e.disputeReason,
    settledAt: e.settledAt,
    resolutionNote: e.resolutionNote,
    events: e.events.map((ev) => ({
      id: ev.id,
      type: ev.type,
      status: ev.status,
      actor: roleOf(ev.actorId),
      note: ev.note,
      createdAt: ev.createdAt,
    })),
  }
}

// อีเมลใช้ติดต่อกันนอกระบบได้ จึงเปิดให้เห็นหลังจ่ายแล้ว ไม่งั้นจะตกลงกันเองแล้วไม่ผ่าน escrow
export const contactVisible = (escrow: { status: EscrowStatus } | null) =>
  escrow === null || escrow.status !== 'AWAITING_PAYMENT'

// รีวิวได้เมื่อเงินจบแล้ว กันการให้คะแนนดีลที่ยังไม่ได้จ่ายหรือยังไม่รู้ผล
export const reviewOpen = (escrow: { status: EscrowStatus } | null) =>
  escrow === null || SETTLED_WITH_MONEY.has(escrow.status)

const findAsParty = async (db: Tx, userId: string, id: string) => {
  const escrow = await db.escrow.findFirst({
    where: { id, OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: { buyerId: true, twoWay: true, status: true, paymentDueAt: true },
  })
  // คนนอกดีลได้ 404 เหมือนไม่มี escrow นี้
  if (!escrow) throw notFound()
  return { ...escrow, isBuyer: escrow.buyerId === userId }
}

const partyView = async (db: Tx, id: string) =>
  toPartyEscrow(await db.escrow.findUniqueOrThrow({ where: { id }, include: partyEscrowInclude }))

// ---- การกระทำของคู่ดีล ----

// เรียกใน transaction เดียวกับ acceptOffer ถ้าสร้างไม่ได้การตอบรับจะ rollback ด้วย
export const createEscrowForOffer = async (
  tx: Tx,
  offer: { id: string; buyerId: string; cashAmount: Prisma.Decimal; hasItems: boolean },
  sellerId: string,
) => {
  const { id } = await tx.escrow.create({
    data: {
      offerId: offer.id,
      buyerId: offer.buyerId,
      sellerId,
      amount: offer.cashAmount,
      twoWay: offer.hasItems,
      paymentDueAt: new Date(Date.now() + PAYMENT_WINDOW_MS),
    },
    select: { id: true },
  })
  await log(tx, id, 'CREATED', 'AWAITING_PAYMENT', sellerId)
}

export const payEscrow = (userId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    const current = await findAsParty(tx, userId, id)
    if (!current.isBuyer) throw wrongParty()
    const now = new Date()
    if (current.status === 'AWAITING_PAYMENT' && current.paymentDueAt <= now) {
      // งานกวาดรันเป็นรอบ เลยกำหนดแล้วต้องจ่ายไม่ได้แม้สถานะยังไม่ถูกเปลี่ยน
      throw new AppError(409, 'ESCROW_PAYMENT_EXPIRED', 'The payment deadline has passed')
    }
    await claim(
      tx,
      id,
      { status: 'AWAITING_PAYMENT', paymentDueAt: { gt: now } },
      { status: 'HELD', paidAt: now, shipDueAt: new Date(now.getTime() + SHIP_WINDOW_MS) },
    )
    const { amount } = await tx.escrow.findUniqueOrThrow({ where: { id }, select: { amount: true } })
    const { reference } = await payments.charge({ escrowId: id, amount })
    await tx.escrow.update({ where: { id }, data: { paymentRef: reference } })
    await log(tx, id, 'PAID', 'HELD', userId)
    return partyView(tx, id)
  })

export const markShipped = (userId: string, id: string, input: ShipEscrowInput) =>
  prisma.$transaction(async (tx) => {
    const current = await findAsParty(tx, userId, id)
    // ดีลเงินล้วนผู้ซื้อไม่มีของต้องส่ง
    if (current.isBuyer && !current.twoWay) throw wrongParty()
    const now = new Date()
    if (current.isBuyer) {
      await claim(
        tx,
        id,
        { status: 'HELD', buyerShippedAt: null },
        { buyerCarrier: input.carrier, buyerTrackingNumber: input.trackingNumber, buyerShippedAt: now },
      )
    } else {
      await claim(
        tx,
        id,
        { status: 'HELD', sellerShippedAt: null },
        { sellerCarrier: input.carrier, sellerTrackingNumber: input.trackingNumber, sellerShippedAt: now },
      )
    }
    const fresh = await tx.escrow.findUniqueOrThrow({
      where: { id },
      select: { twoWay: true, sellerShippedAt: true, buyerShippedAt: true },
    })
    const allShipped = fresh.sellerShippedAt !== null && (!fresh.twoWay || fresh.buyerShippedAt !== null)
    if (allShipped) {
      await claim(tx, id, { status: 'HELD' }, { status: 'SHIPPED', confirmDueAt: new Date(now.getTime() + CONFIRM_WINDOW_MS) })
    }
    await log(tx, id, 'SHIPPED', allShipped ? 'SHIPPED' : 'HELD', userId)
    return partyView(tx, id)
  })

export const confirmReceived = (userId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    const current = await findAsParty(tx, userId, id)
    // ดีลเงินล้วนผู้ขายไม่มีของต้องรับ
    if (!current.isBuyer && !current.twoWay) throw wrongParty()
    const now = new Date()
    if (current.isBuyer) {
      await claim(tx, id, { status: 'SHIPPED', buyerReceivedAt: null }, { buyerReceivedAt: now })
    } else {
      await claim(tx, id, { status: 'SHIPPED', sellerReceivedAt: null }, { sellerReceivedAt: now })
    }
    await log(tx, id, 'RECEIVED', 'SHIPPED', userId)
    const fresh = await tx.escrow.findUniqueOrThrow({
      where: { id },
      select: { twoWay: true, buyerReceivedAt: true, sellerReceivedAt: true },
    })
    if (fresh.buyerReceivedAt !== null && (!fresh.twoWay || fresh.sellerReceivedAt !== null)) {
      await release(tx, id, { status: 'SHIPPED' }, { actorId: userId })
    }
    return partyView(tx, id)
  })

export const disputeEscrow = (userId: string, id: string, { reason }: DisputeEscrowInput) =>
  prisma.$transaction(async (tx) => {
    await findAsParty(tx, userId, id)
    await dispute(tx, id, { status: { in: ['HELD', 'SHIPPED'] } }, userId, reason)
    return partyView(tx, id)
  })

export const cancelEscrow = (userId: string, id: string) =>
  prisma.$transaction(async (tx) => {
    const current = await findAsParty(tx, userId, id)
    if (current.status === 'AWAITING_PAYMENT') {
      await voidUnpaid(tx, id, 'CANCELLED', userId, current.isBuyer ? 'ผู้ซื้อยกเลิกก่อนชำระเงิน' : 'ผู้ขายยกเลิกก่อนชำระเงิน')
    } else if (current.status === 'HELD') {
      // ผู้ซื้อจ่ายแล้วถอนเองไม่ได้ ต้องเปิดข้อพิพาท ไม่งั้นผู้ขายที่กำลังแพ็กของจะโดนยกเลิกกลางทาง
      if (current.isBuyer) throw wrongParty()
      await refund(
        tx,
        id,
        { status: 'HELD', sellerShippedAt: null, buyerShippedAt: null },
        { actorId: userId, note: 'ผู้ขายยกเลิกก่อนส่งของ' },
      )
    } else {
      throw invalidState()
    }
    return partyView(tx, id)
  })

// ---- ตัวเลขบนเมนู ----

export const countEscrowActions = (userId: string) =>
  prisma.escrow.count({
    where: {
      OR: [
        { buyerId: userId, status: 'AWAITING_PAYMENT' },
        { sellerId: userId, status: 'HELD', sellerShippedAt: null },
        { buyerId: userId, status: 'HELD', twoWay: true, buyerShippedAt: null },
        { buyerId: userId, status: 'SHIPPED', buyerReceivedAt: null },
        { sellerId: userId, status: 'SHIPPED', twoWay: true, sellerReceivedAt: null },
      ],
    },
  })

// ---- งานกวาดตามกำหนดเวลาและการระงับบัญชี ----

const SWEEP_BATCH = 200

// ทำทีละรายการคนละ transaction รายการที่พังไม่ขวางรายการอื่น ส่วนรายการที่ผู้ใช้เพิ่งกดชนกันถือว่าไม่ต้องทำแล้ว
const sweepEach = async (rows: { id: string }[], run: (tx: Tx, id: string) => Promise<void>) => {
  for (const { id } of rows) {
    await prisma
      .$transaction((tx) => run(tx, id))
      .catch((err: unknown) => {
        if (err instanceof AppError && err.code === 'ESCROW_INVALID_STATE') return
        console.error(`Escrow sweep failed for ${id}:`, err)
      })
  }
}

const overdue = (where: Prisma.EscrowWhereInput) =>
  prisma.escrow.findMany({ where, select: { id: true }, orderBy: { updatedAt: 'asc' }, take: SWEEP_BATCH })

export const processEscrowDeadlines = async (now = new Date()) => {
  await sweepEach(await overdue({ status: 'AWAITING_PAYMENT', paymentDueAt: { lte: now } }), (tx, id) =>
    voidUnpaid(tx, id, 'EXPIRED', null, 'ไม่ชำระเงินภายในกำหนด'),
  )

  const lateShip = { status: 'HELD', shipDueAt: { lte: now } } satisfies Prisma.EscrowWhereInput
  const nobodyShipped = { ...lateShip, sellerShippedAt: null, buyerShippedAt: null } satisfies Prisma.EscrowWhereInput
  await sweepEach(await overdue(nobodyShipped), (tx, id) =>
    refund(tx, id, nobodyShipped, { actorId: null, note: 'ไม่ส่งของภายในกำหนด' }),
  )
  // ฝั่งหนึ่งส่งแล้วแต่อีกฝั่งไม่ส่ง คืนเงินอัตโนมัติไม่ได้เพราะคนที่ส่งแล้วจะเสียของ ให้ทีมงานตัดสิน
  await sweepEach(await overdue(lateShip), (tx, id) =>
    dispute(tx, id, lateShip, null, 'มีฝ่ายหนึ่งไม่ส่งของภายในกำหนด ทีมงานกำลังตรวจสอบ'),
  )

  const lateConfirm = { status: 'SHIPPED', confirmDueAt: { lte: now } } satisfies Prisma.EscrowWhereInput
  await sweepEach(await overdue(lateConfirm), (tx, id) =>
    release(tx, id, lateConfirm, { actorId: null, note: 'ไม่มีการโต้แย้งภายในกำหนด ระบบโอนเงินให้อัตโนมัติ' }),
  )
}

// ไม่ปล่อยเงินอัตโนมัติให้บัญชีที่ถูกระงับ ข้อความไม่บอกว่าใครถูกระงับเพราะอีกฝ่ายจะเห็น
export const settleEscrowsOfSuspendedUser = async (tx: Tx, userId: string, actorId: string) => {
  const active = await tx.escrow.findMany({
    where: { status: { in: ['AWAITING_PAYMENT', 'HELD', 'SHIPPED'] }, OR: [{ buyerId: userId }, { sellerId: userId }] },
    select: { id: true, status: true, sellerShippedAt: true, buyerShippedAt: true },
  })
  const note = 'ดีลนี้ถูกทีมงานระงับ'
  for (const e of active) {
    if (e.status === 'AWAITING_PAYMENT') {
      await voidUnpaid(tx, e.id, 'CANCELLED', actorId, note)
    } else if (e.status === 'HELD' && !e.sellerShippedAt && !e.buyerShippedAt) {
      await refund(tx, e.id, { status: 'HELD', sellerShippedAt: null, buyerShippedAt: null }, { actorId, note })
    } else {
      await dispute(tx, e.id, { status: e.status }, actorId, `${note} ทีมงานกำลังตรวจสอบ`)
    }
  }
}

// ---- หลังบ้าน ----

const adminParty = {
  select: { id: true, displayName: true, username: true, email: true, status: true },
} satisfies Prisma.UserDefaultArgs
const adminName = { select: { id: true, displayName: true } } satisfies Prisma.UserDefaultArgs

const adminListInclude = {
  buyer: adminParty,
  seller: adminParty,
  offer: { select: { listing: { select: { id: true, title: true } } } },
} satisfies Prisma.EscrowInclude

export const listEscrowsForAdmin = async ({ status, page }: AdminEscrowsQuery) => {
  const where: Prisma.EscrowWhereInput = { ...(status && { status }) }
  const [escrows, total, held] = await prisma.$transaction([
    prisma.escrow.findMany({
      where,
      include: adminListInclude,
      // คิวข้อพิพาทเก่าสุดขึ้นก่อน สถานะอื่นดูความเคลื่อนไหวล่าสุด
      orderBy: { updatedAt: status === 'DISPUTED' ? 'asc' : 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.escrow.count({ where }),
    prisma.escrow.aggregate({ where: { status: { in: HOLDING } }, _sum: { amount: true }, _count: true }),
  ])
  return {
    escrows,
    total,
    page,
    pageSize: PAGE_SIZE,
    holding: { count: held._count, amount: held._sum.amount ?? '0' },
  }
}

export const getEscrowForAdmin = async (id: string) => {
  const escrow = await prisma.escrow.findUnique({
    where: { id },
    include: {
      buyer: adminParty,
      seller: adminParty,
      disputedBy: adminName,
      resolvedBy: adminName,
      events: { orderBy: { createdAt: 'asc' }, include: { actor: adminName } },
      offer: {
        select: {
          id: true,
          listingId: true,
          quantity: true,
          message: true,
          listing: { select: { id: true, title: true } },
          items: { select: { quantity: true, listing: { select: { id: true, title: true } } } },
        },
      },
    },
  })
  if (!escrow) throw notFound()
  // แชทเป็นเรื่องส่วนตัวของคู่ดีล เปิดให้ทีมงานอ่านเฉพาะดีลที่มีข้อพิพาท
  const messages = escrow.disputedAt ? await listDealMessages(escrow.offer.listingId, escrow.buyerId) : []
  return { ...escrow, messages }
}

// เงื่อนไขเดียวกับการอ่านแชท รูปในห้องเปิดให้ทีมงานเฉพาะดีลที่มีข้อพิพาท
export const readEscrowChatImage = async (id: string, messageId: string) => {
  const escrow = await prisma.escrow.findUnique({
    where: { id },
    select: { disputedAt: true, buyerId: true, offer: { select: { listingId: true } } },
  })
  if (!escrow?.disputedAt) throw notFound()
  return readDealImage(escrow.offer.listingId, escrow.buyerId, messageId)
}

export const resolveEscrow = async (actorId: string, id: string, { decision, reason }: ResolveEscrowInput) => {
  await prisma.$transaction(async (tx) => {
    const escrow = await tx.escrow.findUnique({
      where: { id },
      select: { buyerId: true, sellerId: true, offer: { select: { listing: { select: { title: true } } } } },
    })
    if (!escrow) throw notFound()
    // บัญชีที่เคยเป็นคู่ดีลแล้วได้สิทธิ์ admin ภายหลัง ห้ามตัดสินเงินเข้าตัวเอง
    if (actorId === escrow.buyerId || actorId === escrow.sellerId) {
      throw new AppError(403, 'ESCROW_SELF_RESOLVE', 'Cannot resolve your own deal')
    }
    const where = { status: { in: HOLDING } }
    const settlement = { actorId, note: reason, resolvedById: actorId }
    if (decision === 'RELEASE') await release(tx, id, where, settlement)
    else await refund(tx, id, where, settlement)
    await recordAudit(tx, {
      actorId,
      action: decision === 'RELEASE' ? 'ESCROW_RELEASED' : 'ESCROW_REFUNDED',
      targetUserId: decision === 'RELEASE' ? escrow.sellerId : escrow.buyerId,
      detail: `${escrow.offer.listing.title}: ${reason}`,
    })
  })
  return getEscrowForAdmin(id)
}

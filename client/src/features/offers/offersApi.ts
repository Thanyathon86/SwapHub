import { api } from '@shared/lib/api'
import type { Listing } from '@shared/listings/listingsApi'
import type { RatingSummary } from '@shared/reviews/StarRating'

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'

// server ส่งอีเมลมาเฉพาะ offer ที่ตอบรับแล้ว และถ้าเป็นดีลมีเงินต้องจ่ายแล้วด้วย นอกนั้นเป็น null
export type Party = {
  id: string
  displayName: string
  username: string
  avatarKey: string | null
  email: string | null
  rating: RatingSummary
}

// รีวิวที่ทีมงานซ่อน server ส่งมาแค่ removedAt ส่วน rating กับ comment เป็น null
export type OfferReview = {
  reviewerId: string
  rating: number | null
  comment: string | null
  updatedAt: string
  removedAt: string | null
}

export type EscrowStatus =
  | 'AWAITING_PAYMENT'
  | 'HELD'
  | 'SHIPPED'
  | 'DISPUTED'
  | 'RELEASED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'EXPIRED'

export type EscrowEventType = 'CREATED' | 'PAID' | 'SHIPPED' | 'RECEIVED' | 'DISPUTED' | 'RELEASED' | 'REFUNDED' | 'CANCELLED' | 'EXPIRED'

// server ไม่ส่งชื่อทีมงาน บอกแค่ว่าใครทำในฐานะอะไร
export type EscrowActor = 'BUYER' | 'SELLER' | 'STAFF' | 'SYSTEM'

export type Escrow = {
  id: string
  offerId: string
  amount: string
  // ดีลเงินบวกการ์ดแลก ทั้งสองฝ่ายต้องส่งของและยืนยันรับ
  twoWay: boolean
  status: EscrowStatus
  paymentDueAt: string
  shipDueAt: string | null
  confirmDueAt: string | null
  paidAt: string | null
  sellerCarrier: string | null
  sellerTrackingNumber: string | null
  sellerShippedAt: string | null
  buyerCarrier: string | null
  buyerTrackingNumber: string | null
  buyerShippedAt: string | null
  buyerReceivedAt: string | null
  sellerReceivedAt: string | null
  disputedAt: string | null
  disputeReason: string | null
  settledAt: string | null
  resolutionNote: string | null
  events: { id: string; type: EscrowEventType; status: EscrowStatus; actor: EscrowActor; note: string | null; createdAt: string }[]
}

export type Offer = {
  id: string
  listingId: string
  buyerId: string
  quantity: number
  cashAmount: string | null
  message: string | null
  status: OfferStatus
  respondedAt: string | null
  createdAt: string
  updatedAt: string
  listing: Omit<Listing, 'seller'> & { seller: Party }
  buyer: Party
  items: { id: string; listingId: string; quantity: number; listing: Listing }[]
  // รีวิวของดีลนี้ (สูงสุดฝ่ายละหนึ่ง) และวันสุดท้ายที่ยังให้/แก้คะแนนได้ (null ถ้ายังไม่ตอบรับ)
  reviews: OfferReview[]
  reviewDeadline: string | null
  // null เมื่อเป็นการแลกล้วนหรือยังไม่ตอบรับ
  escrow: Escrow | null
}

export type CreateOfferInput = {
  listingId: string
  quantity: number
  cashAmount?: number
  message?: string
  items: { listingId: string; quantity: number }[]
}

type OfferResponse = { offer: Offer }
type OffersResponse = { offers: Offer[] }

const respond = (id: string, action: 'accept' | 'decline' | 'cancel') =>
  api<OfferResponse>(`/offers/${id}/${action}`, { method: 'POST' }).then((r) => r.offer)

export const offersApi = {
  create: (input: CreateOfferInput) =>
    api<OfferResponse>('/offers', { method: 'POST', body: input }).then((r) => r.offer),
  incoming: () => api<OffersResponse>('/offers/incoming').then((r) => r.offers),
  outgoing: () => api<OffersResponse>('/offers/outgoing').then((r) => r.offers),
  accept: (id: string) => respond(id, 'accept'),
  decline: (id: string) => respond(id, 'decline'),
  cancel: (id: string) => respond(id, 'cancel'),
  review: (id: string, input: { rating: number; comment: string }) =>
    api<{ review: OfferReview }>(`/offers/${id}/review`, { method: 'PUT', body: input }).then((r) => r.review),
}

type EscrowResponse = { escrow: Escrow }
const escrowAction = (id: string, action: string, body?: object) =>
  api<EscrowResponse>(`/escrow/${id}/${action}`, { method: 'POST', ...(body && { body }) }).then((r) => r.escrow)

export const escrowApi = {
  pay: (id: string) => escrowAction(id, 'pay'),
  ship: (id: string, input: { carrier: string; trackingNumber: string }) => escrowAction(id, 'ship', input),
  confirm: (id: string) => escrowAction(id, 'confirm'),
  dispute: (id: string, reason: string) => escrowAction(id, 'dispute', { reason }),
  cancel: (id: string) => escrowAction(id, 'cancel'),
}

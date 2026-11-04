import type { EscrowActor, EscrowEventType, EscrowStatus, OfferStatus } from './offersApi'

export const offerStatusLabel: Record<OfferStatus, string> = {
  PENDING: 'รอตอบ',
  ACCEPTED: 'ตอบรับแล้ว',
  DECLINED: 'ถูกปฏิเสธ',
  CANCELLED: 'ยกเลิก',
}

export const offerStatusClass: Record<OfferStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  DECLINED: 'bg-red-50 text-red-700 ring-red-200',
  CANCELLED: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}

export const escrowStatusLabel: Record<EscrowStatus, string> = {
  AWAITING_PAYMENT: 'รอชำระเงิน',
  HELD: 'ถือเงินไว้ รอส่งของ',
  SHIPPED: 'ส่งของแล้ว รอยืนยัน',
  DISPUTED: 'มีข้อพิพาท',
  RELEASED: 'โอนเงินแล้ว',
  REFUNDED: 'คืนเงินแล้ว',
  CANCELLED: 'ยกเลิก',
  EXPIRED: 'เลยกำหนดชำระ',
}

export const escrowStatusClass: Record<EscrowStatus, string> = {
  AWAITING_PAYMENT: 'bg-amber-50 text-amber-700 ring-amber-200',
  HELD: 'bg-blue-50 text-blue-700 ring-blue-200',
  SHIPPED: 'bg-blue-50 text-blue-700 ring-blue-200',
  DISPUTED: 'bg-amber-50 text-amber-800 ring-amber-300',
  RELEASED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REFUNDED: 'bg-zinc-100 text-zinc-700 ring-zinc-200',
  CANCELLED: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
  EXPIRED: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}

export const escrowEventLabel: Record<EscrowEventType, string> = {
  CREATED: 'ตอบรับข้อเสนอ',
  PAID: 'ชำระเงิน (จำลอง)',
  SHIPPED: 'แจ้งส่งของ',
  RECEIVED: 'ยืนยันได้รับของ',
  DISPUTED: 'เปิดข้อพิพาท',
  RELEASED: 'โอนเงินให้ผู้ขาย',
  REFUNDED: 'คืนเงินให้ผู้ซื้อ',
  CANCELLED: 'ยกเลิก',
  EXPIRED: 'เลยกำหนดชำระ',
}

export const escrowActorLabel: Record<EscrowActor, string> = {
  BUYER: 'ผู้ซื้อ',
  SELLER: 'ผู้ขาย',
  STAFF: 'ทีมงาน TCGNexus',
  SYSTEM: 'ระบบ',
}

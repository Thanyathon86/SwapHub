import type { OfferStatus } from './offersApi'

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

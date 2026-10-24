import type { ArtProps } from './ListingArt'
import type { CardCondition, ItemKind, Listing, ListingStatus, ListingType } from './listingsApi'

export const kindLabel: Record<ItemKind, string> = {
  SINGLE: 'การ์ดใบเดี่ยว',
  GRADED: 'การ์ดเกรด',
  SEALED: 'สินค้าซีล',
}

export const typeLabel: Record<ListingType, string> = {
  SALE: 'ขาย',
  TRADE: 'แลก',
  BOTH: 'ขายหรือแลก',
}

export const conditionLabel: Record<CardCondition, string> = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
}

export const statusLabel: Record<ListingStatus, string> = {
  PENDING_REVIEW: 'รอตรวจ',
  ACTIVE: 'เปิดอยู่',
  REJECTED: 'ไม่ผ่าน',
  CLOSED: 'ปิดแล้ว',
}

export const statusClass: Record<ListingStatus, string> = {
  PENDING_REVIEW: 'bg-amber-50 text-amber-700 ring-amber-200',
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  CLOSED: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}

const baht = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 2 })

export const formatPrice = (price: string | null) => (price === null ? null : baht.format(Number(price)))

// "9.0" จาก Decimal แสดงเป็น "9" ให้เหมือนบนป้ายเกรดจริง
export const formatGrade = (grade: string | null) => (grade === null ? '' : String(Number(grade)))

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

export const artPropsOf = (listing: Listing): ArtProps => ({
  gameSlug: listing.game.slug,
  gameName: listing.game.name,
  title: listing.title,
  setName: listing.setName,
  itemKind: listing.itemKind,
  cardNumber: listing.cardNumber,
  condition: listing.condition,
  gradingCompanyName: listing.gradingCompany?.name,
  grade: formatGrade(listing.grade),
})

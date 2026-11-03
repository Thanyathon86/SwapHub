import { formatGrade } from '@shared/listings/labels'
import type { Listing } from '@shared/listings/listingsApi'

// ป้ายสั้น ๆ บอกสภาพหรือเกรด เป็นข้อมูลแรกที่นักสะสมมองหา ต้องเห็นได้โดยไม่ต้องกดเข้าไปดูรายละเอียด
export const listingBadge = (listing: Listing) => {
  if (listing.itemKind === 'GRADED') return `${listing.gradingCompany?.name ?? ''} ${formatGrade(listing.grade)}`.trim()
  if (listing.itemKind === 'SEALED') return 'SEALED'
  return listing.condition
}

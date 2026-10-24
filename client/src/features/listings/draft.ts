import type { CardCondition, CreateListingInput, ItemKind, Listing, ListingType } from '@shared/listings/listingsApi'

export type Draft = {
  itemKind: ItemKind
  type: ListingType
  gameId: string
  title: string
  setName: string
  language: string
  cardNumber: string
  rarity: string
  condition: CardCondition
  gradingCompanyId: string
  grade: string
  certNumber: string
  quantity: string
  price: string
  description: string
}

export const emptyDraft: Draft = {
  itemKind: 'SINGLE',
  type: 'SALE',
  gameId: '',
  title: '',
  setName: '',
  language: 'EN',
  cardNumber: '',
  rarity: '',
  condition: 'NM',
  gradingCompanyId: '',
  grade: '',
  certNumber: '',
  quantity: '1',
  price: '',
  description: '',
}

// เติมฟอร์มจากประกาศเดิมตอนแก้ไข ช่องที่ไม่มีค่าเป็นสตริงว่างเพราะ input ของ React ต้องเป็นสตริง
export const draftFromListing = (l: Listing): Draft => ({
  itemKind: l.itemKind,
  type: l.type,
  gameId: l.gameId,
  title: l.title,
  setName: l.setName,
  language: l.language,
  cardNumber: l.cardNumber ?? '',
  rarity: l.rarity ?? '',
  condition: l.condition ?? 'NM',
  gradingCompanyId: l.gradingCompanyId ?? '',
  grade: l.grade === null ? '' : String(Number(l.grade)),
  certNumber: l.certNumber ?? '',
  quantity: String(l.quantity),
  price: l.price === null ? '' : String(Number(l.price)),
  description: l.description ?? '',
})

// ส่งเฉพาะฟิลด์ของ itemKind ที่เลือก server ใช้ strictObject ถ้าส่งฟิลด์เกินมาจะถูกปฏิเสธ
export const toInput = (d: Draft): CreateListingInput => {
  const base = {
    gameId: d.gameId,
    type: d.type,
    title: d.title,
    setName: d.setName,
    language: d.language,
    description: d.description,
    ...(d.type !== 'TRADE' && d.price !== '' && { price: Number(d.price) }),
  }
  const card = { cardNumber: d.cardNumber, rarity: d.rarity }
  if (d.itemKind === 'SINGLE') {
    return { ...base, ...card, itemKind: 'SINGLE', condition: d.condition, quantity: Number(d.quantity) }
  }
  if (d.itemKind === 'GRADED') {
    return {
      ...base,
      ...card,
      itemKind: 'GRADED',
      gradingCompanyId: d.gradingCompanyId,
      grade: Number(d.grade),
      certNumber: d.certNumber,
    }
  }
  return { ...base, itemKind: 'SEALED', quantity: Number(d.quantity) }
}

import { api } from '../../lib/api'

export type ListingType = 'SALE' | 'TRADE' | 'BOTH'
export type ItemKind = 'SINGLE' | 'GRADED' | 'SEALED'
export type ListingStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'CLOSED'
export type CardCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'

export type CatalogGame = { id: string; name: string; slug: string }
export type CatalogGradingCompany = { id: string; name: string }

// server ส่ง Decimal (price, grade) มาเป็น string เพื่อไม่ให้ทศนิยมเพี้ยน
export type Listing = {
  id: string
  sellerId: string
  gameId: string
  type: ListingType
  itemKind: ItemKind
  status: ListingStatus
  title: string
  setName: string
  language: string
  cardNumber: string | null
  rarity: string | null
  condition: CardCondition | null
  gradingCompanyId: string | null
  grade: string | null
  certNumber: string | null
  quantity: number
  price: string | null
  description: string | null
  rejectReason: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  game: CatalogGame
  gradingCompany: CatalogGradingCompany | null
  seller: { id: string; displayName: string }
}

export type ListingsPage = { listings: Listing[]; total: number; page: number; pageSize: number }

export type BrowseSort = 'newest' | 'price_asc' | 'price_desc'

export type BrowseQuery = {
  q?: string
  game?: string
  itemKind?: ItemKind
  type?: ListingType
  sort?: BrowseSort
  page?: number
}

type BaseInput = {
  gameId: string
  type: ListingType
  title: string
  setName: string
  language: string
  price?: number
  description?: string
}

export type CreateListingInput =
  | (BaseInput & {
      itemKind: 'SINGLE'
      cardNumber?: string
      rarity?: string
      condition: CardCondition
      quantity: number
    })
  | (BaseInput & {
      itemKind: 'GRADED'
      cardNumber?: string
      rarity?: string
      gradingCompanyId: string
      grade: number
      certNumber: string
    })
  | (BaseInput & { itemKind: 'SEALED'; quantity: number })

const browseQueryString = (query: BrowseQuery) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return params.toString()
}

export const listingsApi = {
  games: () => api<{ games: CatalogGame[] }>('/catalog/games').then((r) => r.games),
  gradingCompanies: () =>
    api<{ gradingCompanies: CatalogGradingCompany[] }>('/catalog/grading-companies').then((r) => r.gradingCompanies),

  browse: (query: BrowseQuery) => api<ListingsPage>(`/listings?${browseQueryString(query)}`),
  get: (id: string) => api<{ listing: Listing }>(`/listings/${id}`).then((r) => r.listing),
  mine: () => api<{ listings: Listing[] }>('/listings/mine').then((r) => r.listings),
  create: (input: CreateListingInput) =>
    api<{ listing: Listing }>('/listings', { method: 'POST', body: input }).then((r) => r.listing),
  close: (id: string) => api<{ listing: Listing }>(`/listings/${id}/close`, { method: 'POST' }).then((r) => r.listing),
}

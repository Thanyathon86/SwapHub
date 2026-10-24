import { api } from '../lib/api'
import type { RatingSummary } from '../reviews/StarRating'

export type ListingType = 'SALE' | 'TRADE' | 'BOTH'
export type ItemKind = 'SINGLE' | 'GRADED' | 'SEALED'
export type ListingStatus = 'PENDING_REVIEW' | 'ACTIVE' | 'REJECTED' | 'CLOSED'
export type CardCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG'

export type CatalogGame = { id: string; name: string; slug: string }
export type CatalogGradingCompany = { id: string; name: string }

export type ListingImage = { id: string; key: string; width: number; height: number }

// key เป็น path ภายใน storage ของ server ถ้าย้ายไป CDN แก้ที่นี่ที่เดียว
export const imageUrl = (key: string) => `/uploads/${key}`

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
  // rating มีเฉพาะหน้ารายละเอียดประกาศ หน้ารวมไม่ได้แนบมา
  seller: { id: string; displayName: string; username: string; avatarKey: string | null; rating?: RatingSummary }
  // เรียงตามลำดับ รูปแรกเป็นปก
  images: ListingImage[]
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
  mineOne: (id: string) => api<{ listing: Listing }>(`/listings/mine/${id}`).then((r) => r.listing),
  update: (id: string, input: CreateListingInput) =>
    api<{ listing: Listing }>(`/listings/${id}`, { method: 'PATCH', body: input }).then((r) => r.listing),
  uploadImage: (id: string, file: File) => {
    const form = new FormData()
    form.append('image', file)
    return api<{ listing: Listing }>(`/listings/${id}/images`, { method: 'POST', body: form }).then((r) => r.listing)
  },
  removeImage: (id: string, imageId: string) =>
    api<{ listing: Listing }>(`/listings/${id}/images/${imageId}`, { method: 'DELETE' }).then((r) => r.listing),
  close: (id: string) => api<{ listing: Listing }>(`/listings/${id}/close`, { method: 'POST' }).then((r) => r.listing),
}

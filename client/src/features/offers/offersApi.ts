import { api } from '@shared/lib/api'
import type { Listing } from '@shared/listings/listingsApi'

export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'

// server ส่งอีเมลมาเฉพาะ offer ที่ ACCEPTED แล้ว นอกนั้นเป็น null
type Party = { id: string; displayName: string; email: string | null }

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
}

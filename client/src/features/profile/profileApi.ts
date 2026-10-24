import type { AuthUser } from '@shared/auth/authApi'
import { api } from '@shared/lib/api'
import type { Listing } from '@shared/listings/listingsApi'
import type { RatingSummary } from '@shared/reviews/StarRating'

export type PublicProfile = {
  id: string
  username: string
  displayName: string
  avatarKey: string | null
  bio: string | null
  location: string | null
  createdAt: string
  stats: { activeListings: number; deals: number; rating: RatingSummary }
}

export type ProfileReview = {
  id: string
  rating: number
  comment: string | null
  createdAt: string
  updatedAt: string
  reviewer: { username: string; displayName: string; avatarKey: string | null }
  // มุมของคนเขียนต่อเจ้าของโปรไฟล์: BUYER = มาซื้อ/ขอแลกจากเจ้าของโปรไฟล์
  reviewerRole: 'BUYER' | 'SELLER'
  listingTitle: string
}

export type ReviewsPage = { reviews: ProfileReview[]; total: number; page: number; pageSize: number }

export type ProfileInput = { displayName: string; username: string; bio: string; location: string }

type UserResponse = { user: AuthUser }

export const profileApi = {
  get: (username: string) =>
    api<{ profile: PublicProfile; listings: Listing[] }>(`/users/${encodeURIComponent(username)}`),
  reviews: (username: string, page: number) =>
    api<ReviewsPage>(`/users/${encodeURIComponent(username)}/reviews?page=${page}`),
  update: (input: ProfileInput) =>
    api<UserResponse>('/me/profile', { method: 'PATCH', body: input }).then((r) => r.user),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('image', file)
    return api<UserResponse>('/me/avatar', { method: 'POST', body: form }).then((r) => r.user)
  },
  removeAvatar: () => api<UserResponse>('/me/avatar', { method: 'DELETE' }).then((r) => r.user),
}

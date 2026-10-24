import type { AuthUser } from '@shared/auth/authApi'
import { api } from '@shared/lib/api'
import type { Listing } from '@shared/listings/listingsApi'

export type PublicProfile = {
  id: string
  username: string
  displayName: string
  avatarKey: string | null
  bio: string | null
  location: string | null
  createdAt: string
  stats: { activeListings: number; deals: number }
}

export type ProfileInput = { displayName: string; username: string; bio: string; location: string }

type UserResponse = { user: AuthUser }

export const profileApi = {
  get: (username: string) =>
    api<{ profile: PublicProfile; listings: Listing[] }>(`/users/${encodeURIComponent(username)}`),
  update: (input: ProfileInput) =>
    api<UserResponse>('/me/profile', { method: 'PATCH', body: input }).then((r) => r.user),
  uploadAvatar: (file: File) => {
    const form = new FormData()
    form.append('image', file)
    return api<UserResponse>('/me/avatar', { method: 'POST', body: form }).then((r) => r.user)
  },
  removeAvatar: () => api<UserResponse>('/me/avatar', { method: 'DELETE' }).then((r) => r.user),
}

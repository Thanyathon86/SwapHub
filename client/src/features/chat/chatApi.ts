import { api } from '@shared/lib/api'
import type { Listing } from '@shared/listings/listingsApi'
import type { OfferStatus } from '../offers/offersApi'

export type ChatMessage = {
  id: string
  conversationId: string
  authorId: string
  body: string | null
  image: { width: number; height: number } | null
  createdAt: string
}

export type Conversation = {
  id: string
  role: 'BUYER' | 'SELLER'
  listing: Listing
  other: { id: string; displayName: string; username: string; avatarKey: string | null }
  lastMessage: ChatMessage | null
  lastMessageAt: string | null
  unread: number
  otherLastReadAt: string | null
  // server ไม่บอกเหตุผล ถ้าส่งไม่ได้และไม่ได้บล็อกเอง แปลว่าอีกฝ่ายไม่พร้อมรับข้อความ
  canSend: boolean
  blockedByMe: boolean
}

// ได้เพิ่มตอนเปิดห้องเดียว หน้ารายการไม่ดึงข้อเสนอของทุกห้อง
export type ConversationDetail = Conversation & { latestOffer: { id: string; status: OfferStatus } | null }

export type MessagesPage = { messages: ChatMessage[]; hasMore: boolean }

type ConversationResponse = { conversation: ConversationDetail }
const conversation = (r: ConversationResponse) => r.conversation

// รูปในแชทอยู่หลัง API ที่ตรวจสิทธิ์ ไม่ใช้ imageUrl ของรูปประกาศ
export const chatImageUrl = (messageId: string) => `/api/chat/images/${messageId}`

export const chatApi = {
  list: () => api<{ conversations: Conversation[] }>('/chat/conversations').then((r) => r.conversations),
  open: (input: { listingId: string } | { offerId: string }) =>
    api<ConversationResponse>('/chat/conversations', { method: 'POST', body: input }).then(conversation),
  get: (id: string) => api<ConversationResponse>(`/chat/conversations/${id}`).then(conversation),
  messages: (id: string, before?: string) =>
    api<MessagesPage>(`/chat/conversations/${id}/messages${before ? `?before=${before}` : ''}`),
  send: (id: string, body: string) =>
    api<{ message: ChatMessage }>(`/chat/conversations/${id}/messages`, { method: 'POST', body: { body } }).then((r) => r.message),
  sendImage: (id: string, file: File) => {
    const form = new FormData()
    form.append('image', file)
    return api<{ message: ChatMessage }>(`/chat/conversations/${id}/images`, { method: 'POST', body: form }).then((r) => r.message)
  },
  read: (id: string) => api<void>(`/chat/conversations/${id}/read`, { method: 'POST' }),
  block: (id: string) => api<ConversationResponse>(`/chat/conversations/${id}/block`, { method: 'PUT' }).then(conversation),
  unblock: (id: string) => api<ConversationResponse>(`/chat/conversations/${id}/block`, { method: 'DELETE' }).then(conversation),
}

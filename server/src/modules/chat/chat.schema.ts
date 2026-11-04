import { z } from 'zod'

export const conversationIdParams = z.strictObject({ id: z.uuid() })
export const messageIdParams = z.strictObject({ messageId: z.uuid() })

// เปิดห้องจากหน้าประกาศ (ผู้ซื้อ) หรือจากข้อเสนอ (ได้ทั้งสองฝ่าย และประกาศอาจปิดไปแล้ว)
export const openConversationSchema = z.union([
  z.strictObject({ listingId: z.uuid() }),
  z.strictObject({ offerId: z.uuid() }),
])

export const messagesQuery = z.strictObject({
  // โหลดข้อความที่เก่ากว่าข้อความนี้
  before: z.uuid().optional(),
})

export const sendMessageSchema = z.strictObject({ body: z.string().trim().min(1).max(2000) })

export type ConversationIdParams = z.infer<typeof conversationIdParams>
export type MessageIdParams = z.infer<typeof messageIdParams>
export type OpenConversationInput = z.infer<typeof openConversationSchema>
export type MessagesQuery = z.infer<typeof messagesQuery>
export type SendMessageInput = z.infer<typeof sendMessageSchema>

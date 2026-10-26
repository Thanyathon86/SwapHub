import { z } from 'zod'

export const reviewSchema = z.strictObject({
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => v || null),
})

export const reviewsQuery = z.strictObject({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export const reviewIdParams = z.strictObject({ id: z.uuid() })

export const adminReviewsQuery = z.strictObject({
  // ค้นจาก username ของคนเขียนหรือคนที่ถูกรีวิว ช่องว่างถือว่าไม่ได้ค้น
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  status: z.enum(['VISIBLE', 'REMOVED']).default('VISIBLE'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export const removeReviewSchema = z.strictObject({ reason: z.string().trim().min(1).max(500) })

export type ReviewInput = z.infer<typeof reviewSchema>
export type ReviewsQuery = z.infer<typeof reviewsQuery>
export type ReviewIdParams = z.infer<typeof reviewIdParams>
export type AdminReviewsQuery = z.infer<typeof adminReviewsQuery>
export type RemoveReviewInput = z.infer<typeof removeReviewSchema>

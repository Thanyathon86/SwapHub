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

export type ReviewInput = z.infer<typeof reviewSchema>
export type ReviewsQuery = z.infer<typeof reviewsQuery>

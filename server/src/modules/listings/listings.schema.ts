import { z } from 'zod'
import { CardCondition, ItemKind, ListingStatus, ListingType } from '../../generated/prisma/enums.js'

const text = (max: number) => z.string().trim().min(1).max(max)
// ช่องที่ไม่บังคับ ถ้า form ส่งสตริงว่างมาให้ถือว่าไม่ได้กรอก
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined)

// ตรงกับ Decimal(12, 2) ใน DB เช็กทศนิยมเองเพราะ multipleOf(0.01) พังกับเลขทศนิยมของ float
const price = z
  .number()
  .positive()
  .max(9_999_999_999.99)
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'At most 2 decimal places')

const quantity = z.number().int().min(1).max(999)

const base = {
  gameId: z.uuid(),
  type: z.enum(ListingType),
  title: text(120),
  setName: text(120),
  language: text(30),
  price: price.optional(),
  description: optionalText(2000),
}

const cardInfo = {
  cardNumber: optionalText(30),
  rarity: optionalText(40),
}

// GRADED ไม่รับ quantity เพราะการ์ดเกรดแต่ละใบมีเลขเซอร์ของตัวเอง ใช้ค่า default 1 ใน DB
export const createListingSchema = z
  .discriminatedUnion('itemKind', [
    z.strictObject({
      ...base,
      ...cardInfo,
      itemKind: z.literal(ItemKind.SINGLE),
      condition: z.enum(CardCondition),
      quantity,
    }),
    z.strictObject({
      ...base,
      ...cardInfo,
      itemKind: z.literal(ItemKind.GRADED),
      gradingCompanyId: z.uuid(),
      // ทุกบริษัทให้เกรด 1-10 และอย่างละเอียดสุดคือครึ่งเกรด
      grade: z
        .number()
        .min(1)
        .max(10)
        .refine((v) => Number.isInteger(v * 2), 'Grade must be in steps of 0.5'),
      certNumber: text(30),
    }),
    z.strictObject({
      ...base,
      itemKind: z.literal(ItemKind.SEALED),
      quantity,
    }),
  ])
  .superRefine((input, ctx) => {
    if (input.type !== 'TRADE' && input.price === undefined) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Price is required for sale listings' })
    }
    // ประกาศแลกอย่างเดียวมีราคาไม่ได้ กันผู้ซื้อเข้าใจผิดว่าซื้อได้
    if (input.type === 'TRADE' && input.price !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['price'], message: 'Trade-only listings cannot have a price' })
    }
  })

export const listingIdParams = z.strictObject({ id: z.uuid() })

const page = z.coerce.number().int().min(1).max(10_000).default(1)

export const browseListingsQuery = z.strictObject({
  q: optionalText(100),
  game: optionalText(60),
  itemKind: z.enum(ItemKind).optional(),
  type: z.enum(ListingType).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  page,
})

export const adminListingsQuery = z.strictObject({
  status: z.enum(ListingStatus).default('PENDING_REVIEW'),
  page,
})

export const reviewListingSchema = z.discriminatedUnion('decision', [
  z.strictObject({ decision: z.literal('APPROVE') }),
  // บังคับใส่เหตุผลเพื่อให้ผู้ขายแก้แล้วลงใหม่ได้ถูก
  z.strictObject({ decision: z.literal('REJECT'), reason: text(500) }),
])

export type CreateListingInput = z.infer<typeof createListingSchema>
export type ListingIdParams = z.infer<typeof listingIdParams>
export type BrowseListingsQuery = z.infer<typeof browseListingsQuery>
export type AdminListingsQuery = z.infer<typeof adminListingsQuery>
export type ReviewListingInput = z.infer<typeof reviewListingSchema>

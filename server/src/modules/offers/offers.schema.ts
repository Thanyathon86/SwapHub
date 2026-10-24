import { z } from 'zod'
import { optionalText, price, quantity } from '../listings/listings.schema.js'

export const createOfferSchema = z
  .strictObject({
    listingId: z.uuid(),
    quantity: quantity.default(1),
    cashAmount: price.optional(),
    message: optionalText(1000),
    // จำกัดจำนวนรายการกันคนส่ง offer ใหญ่จน query ช้า
    items: z
      .array(z.strictObject({ listingId: z.uuid(), quantity: quantity.default(1) }))
      .max(10)
      .default([]),
  })
  .superRefine((input, ctx) => {
    if (input.cashAmount === undefined && input.items.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Offer must include cash or trade items' })
    }
    const ids = input.items.map((i) => i.listingId)
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['items'], message: 'Duplicate trade items' })
    }
  })

export const offerIdParams = z.strictObject({ id: z.uuid() })

export type CreateOfferInput = z.infer<typeof createOfferSchema>
export type OfferIdParams = z.infer<typeof offerIdParams>

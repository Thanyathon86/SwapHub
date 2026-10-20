import { z } from 'zod'

const name = z.string().trim().min(1).max(60)
// slug ใช้ใน URL หน้าเว็บ จำกัดให้เป็นตัวเล็ก ตัวเลข และขีดเท่านั้น
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens')

// PATCH ที่ไม่มีฟิลด์เลยน่าจะเป็นบั๊กฝั่ง client ปฏิเสธไปเลยดีกว่าตอบสำเร็จแบบไม่ทำอะไร
const nonEmpty = (o: object) => Object.keys(o).length > 0
const nonEmptyMessage = { message: 'At least one field is required' }

export const idParams = z.strictObject({ id: z.uuid() })

export const createGameSchema = z.strictObject({ name, slug, isActive: z.boolean().optional() })
export const updateGameSchema = createGameSchema.partial().refine(nonEmpty, nonEmptyMessage)

export const createGradingCompanySchema = z.strictObject({ name, isActive: z.boolean().optional() })
export const updateGradingCompanySchema = createGradingCompanySchema.partial().refine(nonEmpty, nonEmptyMessage)

export type IdParams = z.infer<typeof idParams>
export type CreateGameInput = z.infer<typeof createGameSchema>
export type UpdateGameInput = z.infer<typeof updateGameSchema>
export type CreateGradingCompanyInput = z.infer<typeof createGradingCompanySchema>
export type UpdateGradingCompanyInput = z.infer<typeof updateGradingCompanySchema>

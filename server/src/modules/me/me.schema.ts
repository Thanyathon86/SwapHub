import { z } from 'zod'

// ช่องที่ไม่บังคับ ถ้าส่งสตริงว่างมาแปลว่าลบออก
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)

// แบบเดียวกับ IG: ตัวพิมพ์เล็ก ตัวเลข _ และ . ห้ามขึ้นต้น/ลงท้ายด้วยจุดหรือมีจุดติดกัน (ดูเหมือนโดเมน)
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,20}$/, 'Use 3-20 characters: a-z, 0-9, _ or .')
  .refine((v) => !v.startsWith('.') && !v.endsWith('.') && !v.includes('..'), 'Dots cannot be at the ends or repeated')

export const updateProfileSchema = z.strictObject({
  displayName: z.string().trim().min(1).max(50),
  username: usernameSchema,
  bio: optionalText(150),
  location: optionalText(60),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

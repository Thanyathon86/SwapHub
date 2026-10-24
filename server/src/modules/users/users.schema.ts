import { z } from 'zod'
import { Role, UserStatus } from '../../generated/prisma/enums.js'

export const userIdParams = z.strictObject({ id: z.uuid() })

export const listUsersQuery = z.strictObject({
  // ช่องค้นหาว่างจาก form ถือว่าไม่ได้ค้น
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
  status: z.enum(UserStatus).optional(),
  role: z.enum(Role).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
})

export const updateUserStatusSchema = z.strictObject({ status: z.enum(UserStatus) })

export const updateUserRoleSchema = z.strictObject({ role: z.enum(Role) })

export type UserIdParams = z.infer<typeof userIdParams>
export type ListUsersQuery = z.infer<typeof listUsersQuery>
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>

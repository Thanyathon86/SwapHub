import { Router } from 'express'
import { getAuthUser } from '../../middleware/requireAuth.js'
import { validate } from '../../middleware/validate.js'
import {
  listUsersQuery,
  updateUserStatusSchema,
  userIdParams,
  type ListUsersQuery,
  type UpdateUserStatusInput,
  type UserIdParams,
} from './users.schema.js'
import * as usersService from './users.service.js'

// mount ใต้ adminRouter เท่านั้น สิทธิ์ ADMIN ถูกตรวจที่นั่นแล้ว
export const usersAdminRouter = Router()

usersAdminRouter.get('/', validate({ query: listUsersQuery }), async (req, res) => {
  res.json(await usersService.listUsers(req.query as unknown as ListUsersQuery))
})

usersAdminRouter.patch(
  '/:id/status',
  validate({ params: userIdParams, body: updateUserStatusSchema }),
  async (req, res) => {
    const { id } = req.params as UserIdParams
    const user = await usersService.setUserStatus(getAuthUser(req).id, id, req.body as UpdateUserStatusInput)
    res.json({ user })
  },
)

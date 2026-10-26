import { Router } from 'express'
import { getAuthUser } from '../../middleware/requireAuth.js'
import { validate } from '../../middleware/validate.js'
import {
  adminReviewsQuery,
  removeReviewSchema,
  reviewIdParams,
  type AdminReviewsQuery,
  type RemoveReviewInput,
  type ReviewIdParams,
} from './reviews.schema.js'
import * as reviewsService from './reviews.service.js'

// mount ใต้ adminRouter เท่านั้น สิทธิ์ ADMIN ถูกตรวจที่นั่นแล้ว
export const reviewsAdminRouter = Router()

reviewsAdminRouter.get('/', validate({ query: adminReviewsQuery }), async (req, res) => {
  res.json(await reviewsService.listReviewsForAdmin(req.query as unknown as AdminReviewsQuery))
})

// POST ไม่ใช่ DELETE เพราะต้องส่งเหตุผลมาใน body และแถวไม่ได้ถูกลบจริง
reviewsAdminRouter.post(
  '/:id/remove',
  validate({ params: reviewIdParams, body: removeReviewSchema }),
  async (req, res) => {
    const { id } = req.params as ReviewIdParams
    res.json({ review: await reviewsService.removeReview(getAuthUser(req).id, id, req.body as RemoveReviewInput) })
  },
)

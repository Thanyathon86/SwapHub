import { Router } from 'express'
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js'
import { validate } from '../../middleware/validate.js'
import { reviewSchema, type ReviewInput } from '../reviews/reviews.schema.js'
import * as reviewsService from '../reviews/reviews.service.js'
import {
  createOfferSchema,
  offerIdParams,
  offerMessageSchema,
  type CreateOfferInput,
  type OfferIdParams,
  type OfferMessageInput,
} from './offers.schema.js'
import * as offersService from './offers.service.js'

export const offersRouter = Router()

// offer เป็นข้อมูลระหว่างสองฝ่าย ทุกเส้นต้อง login
offersRouter.use(requireAuth)

offersRouter.post('/', validate({ body: createOfferSchema }), async (req, res) => {
  const offer = await offersService.createOffer(getAuthUser(req).id, req.body as CreateOfferInput)
  res.status(201).json({ offer })
})

offersRouter.get('/incoming', async (req, res) => {
  res.json({ offers: await offersService.listIncoming(getAuthUser(req).id) })
})

offersRouter.get('/outgoing', async (req, res) => {
  res.json({ offers: await offersService.listOutgoing(getAuthUser(req).id) })
})

offersRouter.post('/:id/accept', validate({ params: offerIdParams }), async (req, res) => {
  const { id } = req.params as OfferIdParams
  res.json({ offer: await offersService.acceptOffer(getAuthUser(req).id, id) })
})

offersRouter.post('/:id/decline', validate({ params: offerIdParams }), async (req, res) => {
  const { id } = req.params as OfferIdParams
  res.json({ offer: await offersService.declineOffer(getAuthUser(req).id, id) })
})

offersRouter.post('/:id/cancel', validate({ params: offerIdParams }), async (req, res) => {
  const { id } = req.params as OfferIdParams
  res.json({ offer: await offersService.cancelOffer(getAuthUser(req).id, id) })
})

// PUT เพราะให้ซ้ำได้: ครั้งแรกสร้าง ครั้งต่อไปแก้รีวิวเดิม (หนึ่งคนหนึ่งรีวิวต่อดีล)
offersRouter.put('/:id/review', validate({ params: offerIdParams, body: reviewSchema }), async (req, res) => {
  const { id } = req.params as OfferIdParams
  res.json({ review: await reviewsService.upsertReview(getAuthUser(req).id, id, req.body as ReviewInput) })
})

offersRouter.get('/:id/messages', validate({ params: offerIdParams }), async (req, res) => {
  const { id } = req.params as OfferIdParams
  res.json(await offersService.listMessages(getAuthUser(req).id, id))
})

offersRouter.post('/:id/messages', validate({ params: offerIdParams, body: offerMessageSchema }), async (req, res) => {
  const { id } = req.params as OfferIdParams
  const message = await offersService.sendMessage(getAuthUser(req).id, id, req.body as OfferMessageInput)
  res.status(201).json({ message })
})

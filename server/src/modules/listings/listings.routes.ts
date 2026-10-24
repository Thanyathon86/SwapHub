import { Router } from 'express'
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js'
import { validate } from '../../middleware/validate.js'
import {
  adminListingsQuery,
  browseListingsQuery,
  createListingSchema,
  listingIdParams,
  reviewListingSchema,
  type AdminListingsQuery,
  type BrowseListingsQuery,
  type CreateListingInput,
  type ListingIdParams,
  type ReviewListingInput,
} from './listings.schema.js'
import * as listingsService from './listings.service.js'

export const listingsRouter = Router()

listingsRouter.get('/', validate({ query: browseListingsQuery }), async (req, res) => {
  res.json(await listingsService.browseListings(req.query as unknown as BrowseListingsQuery))
})

// ต้องอยู่ก่อน /:id ไม่งั้น "mine" จะถูกจับเป็น id
listingsRouter.get('/mine', requireAuth, async (req, res) => {
  res.json({ listings: await listingsService.listMyListings(getAuthUser(req).id) })
})

listingsRouter.get('/mine/:id', requireAuth, validate({ params: listingIdParams }), async (req, res) => {
  const { id } = req.params as ListingIdParams
  res.json({ listing: await listingsService.getMyListing(getAuthUser(req).id, id) })
})

listingsRouter.get('/:id', validate({ params: listingIdParams }), async (req, res) => {
  const { id } = req.params as ListingIdParams
  res.json({ listing: await listingsService.getListing(id) })
})

listingsRouter.post('/', requireAuth, validate({ body: createListingSchema }), async (req, res) => {
  const listing = await listingsService.createListing(getAuthUser(req).id, req.body as CreateListingInput)
  res.status(201).json({ listing })
})

// ส่งข้อมูลทั้งชุดแบบเดียวกับตอนสร้าง (เขียนทับทุกฟิลด์) ใช้ schema เดียวกันจะได้มีกฎตรงกัน
listingsRouter.patch(
  '/:id',
  requireAuth,
  validate({ params: listingIdParams, body: createListingSchema }),
  async (req, res) => {
    const { id } = req.params as ListingIdParams
    const listing = await listingsService.updateListing(getAuthUser(req).id, id, req.body as CreateListingInput)
    res.json({ listing })
  },
)

listingsRouter.post('/:id/close', requireAuth, validate({ params: listingIdParams }), async (req, res) => {
  const { id } = req.params as ListingIdParams
  res.json({ listing: await listingsService.closeListing(getAuthUser(req).id, id) })
})

// mount ใต้ adminRouter เท่านั้น สิทธิ์ ADMIN ถูกตรวจที่นั่นแล้ว
export const listingsAdminRouter = Router()

listingsAdminRouter.get('/', validate({ query: adminListingsQuery }), async (req, res) => {
  res.json(await listingsService.listForReview(req.query as unknown as AdminListingsQuery))
})

listingsAdminRouter.patch(
  '/:id/review',
  validate({ params: listingIdParams, body: reviewListingSchema }),
  async (req, res) => {
    const { id } = req.params as ListingIdParams
    const listing = await listingsService.reviewListing(getAuthUser(req).id, id, req.body as ReviewListingInput)
    res.json({ listing })
  },
)

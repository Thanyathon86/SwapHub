import { Router } from 'express'
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js'
import { validate } from '../../middleware/validate.js'
import {
  adminEscrowsQuery,
  disputeEscrowSchema,
  escrowIdParams,
  resolveEscrowSchema,
  shipEscrowSchema,
  type AdminEscrowsQuery,
  type DisputeEscrowInput,
  type EscrowIdParams,
  type ResolveEscrowInput,
  type ShipEscrowInput,
} from './escrow.schema.js'
import * as escrowService from './escrow.service.js'

export const escrowRouter = Router()

escrowRouter.use(requireAuth)

escrowRouter.post('/:id/pay', validate({ params: escrowIdParams }), async (req, res) => {
  const { id } = req.params as EscrowIdParams
  res.json({ escrow: await escrowService.payEscrow(getAuthUser(req).id, id) })
})

escrowRouter.post('/:id/ship', validate({ params: escrowIdParams, body: shipEscrowSchema }), async (req, res) => {
  const { id } = req.params as EscrowIdParams
  res.json({ escrow: await escrowService.markShipped(getAuthUser(req).id, id, req.body as ShipEscrowInput) })
})

escrowRouter.post('/:id/confirm', validate({ params: escrowIdParams }), async (req, res) => {
  const { id } = req.params as EscrowIdParams
  res.json({ escrow: await escrowService.confirmReceived(getAuthUser(req).id, id) })
})

escrowRouter.post('/:id/dispute', validate({ params: escrowIdParams, body: disputeEscrowSchema }), async (req, res) => {
  const { id } = req.params as EscrowIdParams
  res.json({ escrow: await escrowService.disputeEscrow(getAuthUser(req).id, id, req.body as DisputeEscrowInput) })
})

escrowRouter.post('/:id/cancel', validate({ params: escrowIdParams }), async (req, res) => {
  const { id } = req.params as EscrowIdParams
  res.json({ escrow: await escrowService.cancelEscrow(getAuthUser(req).id, id) })
})

// mount ใต้ adminRouter เท่านั้น สิทธิ์ ADMIN ถูกตรวจที่นั่นแล้ว
export const escrowAdminRouter = Router()

escrowAdminRouter.get('/', validate({ query: adminEscrowsQuery }), async (req, res) => {
  res.json(await escrowService.listEscrowsForAdmin(req.query as unknown as AdminEscrowsQuery))
})

escrowAdminRouter.get('/:id', validate({ params: escrowIdParams }), async (req, res) => {
  const { id } = req.params as EscrowIdParams
  res.json({ escrow: await escrowService.getEscrowForAdmin(id) })
})

escrowAdminRouter.post('/:id/resolve', validate({ params: escrowIdParams, body: resolveEscrowSchema }), async (req, res) => {
  const { id } = req.params as EscrowIdParams
  res.json({ escrow: await escrowService.resolveEscrow(getAuthUser(req).id, id, req.body as ResolveEscrowInput) })
})

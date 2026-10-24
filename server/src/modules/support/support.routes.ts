import { Router } from 'express'
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js'
import { validate } from '../../middleware/validate.js'
import {
  adminTicketsQuery,
  createTicketSchema,
  ticketIdParams,
  ticketMessageSchema,
  type AdminTicketsQuery,
  type CreateTicketInput,
  type TicketIdParams,
  type TicketMessageInput,
} from './support.schema.js'
import * as supportService from './support.service.js'

export const supportRouter = Router()

supportRouter.use(requireAuth)

supportRouter.post('/tickets', validate({ body: createTicketSchema }), async (req, res) => {
  const ticket = await supportService.createTicket(getAuthUser(req).id, req.body as CreateTicketInput)
  res.status(201).json({ ticket })
})

supportRouter.get('/tickets', async (req, res) => {
  res.json({ tickets: await supportService.listMyTickets(getAuthUser(req).id) })
})

supportRouter.get('/tickets/:id', validate({ params: ticketIdParams }), async (req, res) => {
  const { id } = req.params as TicketIdParams
  res.json({ ticket: await supportService.getMyTicket(getAuthUser(req).id, id) })
})

supportRouter.post(
  '/tickets/:id/messages',
  validate({ params: ticketIdParams, body: ticketMessageSchema }),
  async (req, res) => {
    const { id } = req.params as TicketIdParams
    const { body } = req.body as TicketMessageInput
    res.json({ ticket: await supportService.addUserMessage(getAuthUser(req).id, id, body) })
  },
)

supportRouter.post('/tickets/:id/close', validate({ params: ticketIdParams }), async (req, res) => {
  const { id } = req.params as TicketIdParams
  res.json({ ticket: await supportService.closeMyTicket(getAuthUser(req).id, id) })
})

// mount ใต้ adminRouter เท่านั้น สิทธิ์ ADMIN ถูกตรวจที่นั่นแล้ว
export const supportAdminRouter = Router()

supportAdminRouter.get('/tickets', validate({ query: adminTicketsQuery }), async (req, res) => {
  res.json(await supportService.listTickets(req.query as unknown as AdminTicketsQuery))
})

supportAdminRouter.get('/tickets/:id', validate({ params: ticketIdParams }), async (req, res) => {
  const { id } = req.params as TicketIdParams
  res.json({ ticket: await supportService.getTicket(id) })
})

supportAdminRouter.post(
  '/tickets/:id/messages',
  validate({ params: ticketIdParams, body: ticketMessageSchema }),
  async (req, res) => {
    const { id } = req.params as TicketIdParams
    const { body } = req.body as TicketMessageInput
    res.json({ ticket: await supportService.addStaffMessage(getAuthUser(req).id, id, body) })
  },
)

supportAdminRouter.post('/tickets/:id/assign', validate({ params: ticketIdParams }), async (req, res) => {
  const { id } = req.params as TicketIdParams
  res.json({ ticket: await supportService.assignTicket(getAuthUser(req).id, id) })
})

supportAdminRouter.post('/tickets/:id/close', validate({ params: ticketIdParams }), async (req, res) => {
  const { id } = req.params as TicketIdParams
  res.json({ ticket: await supportService.closeTicket(id) })
})

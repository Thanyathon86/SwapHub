import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { listEventsQuery, type ListEventsQuery } from './events.schema.js'
import * as eventsService from './events.service.js'

// mount ใต้ adminRouter เท่านั้น สิทธิ์ ADMIN ถูกตรวจที่นั่นแล้ว
export const eventsAdminRouter = Router()

eventsAdminRouter.get('/', validate({ query: listEventsQuery }), async (req, res) => {
  res.json(await eventsService.listEvents(req.query as unknown as ListEventsQuery))
})

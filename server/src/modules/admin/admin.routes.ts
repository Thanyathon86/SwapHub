import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { auditAdminRouter } from '../audit/audit.routes.js'
import { catalogAdminRouter } from '../catalog/catalog.routes.js'
import { eventsAdminRouter } from '../events/events.routes.js'
import { listingsAdminRouter } from '../listings/listings.routes.js'
import { usersAdminRouter } from '../users/users.routes.js'
import * as adminService from './admin.service.js'

export const adminRouter = Router()

// ตรวจสิทธิ์ครั้งเดียวที่ระดับ router ทุก route ที่เพิ่มในไฟล์นี้หรือ mount ใต้นี้จะถูกป้องกันอัตโนมัติ
adminRouter.use(requireAuth, requireRole('ADMIN'))

adminRouter.get('/dashboard', async (_req, res) => {
  res.json(await adminService.getDashboard())
})

adminRouter.use(catalogAdminRouter)
adminRouter.use('/users', usersAdminRouter)
adminRouter.use('/listings', listingsAdminRouter)
adminRouter.use('/audit-logs', auditAdminRouter)
adminRouter.use('/events', eventsAdminRouter)

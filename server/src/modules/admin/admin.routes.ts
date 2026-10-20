import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { requireRole } from '../../middleware/requireRole.js'
import { catalogAdminRouter } from '../catalog/catalog.routes.js'
import { usersAdminRouter } from '../users/users.routes.js'
import * as adminService from './admin.service.js'

export const adminRouter = Router()

// ตรวจสิทธิ์ครั้งเดียวที่ระดับ router ทุก route ที่เพิ่มในไฟล์นี้หรือ mount ใต้นี้จะถูกป้องกันอัตโนมัติ
adminRouter.use(requireAuth, requireRole('ADMIN'))

adminRouter.get('/stats', async (_req, res) => {
  res.json({ stats: await adminService.getStats() })
})

adminRouter.use(catalogAdminRouter)
adminRouter.use('/users', usersAdminRouter)

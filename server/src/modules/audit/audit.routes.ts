import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import { listAuditLogsQuery, type ListAuditLogsQuery } from './audit.schema.js'
import * as auditService from './audit.service.js'

// mount ใต้ adminRouter เท่านั้น สิทธิ์ ADMIN ถูกตรวจที่นั่นแล้ว
// มีแค่ GET ตั้งใจไม่ให้แก้หรือลบ log ผ่าน API
export const auditAdminRouter = Router()

auditAdminRouter.get('/', validate({ query: listAuditLogsQuery }), async (req, res) => {
  res.json(await auditService.listAuditLogs(req.query as unknown as ListAuditLogsQuery))
})

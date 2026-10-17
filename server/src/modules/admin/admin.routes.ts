import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import { requireRole } from '../../middleware/requireRole.js'

export const adminRouter = Router()

// ตรวจสิทธิ์ครั้งเดียวที่ระดับ router ทุก route ที่เพิ่มในไฟล์นี้หรือ mount ใต้นี้จะถูกป้องกันอัตโนมัติ
adminRouter.use(requireAuth, requireRole('ADMIN'))

// ไว้ทดสอบสิทธิ์ ลบได้เมื่อมี route admin จริง
adminRouter.get('/ping', (_req, res) => {
  res.json({ ok: true })
})

import { Router } from 'express'
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js'
import * as meService from './me.service.js'

export const meRouter = Router()

meRouter.use(requireAuth)

// หน้าเว็บเรียกทุกนาทีเพื่อแสดงตัวเลขบนเมนู จึงคืนแค่ตัวเลข ไม่ดึงรายการ
meRouter.get('/counts', async (req, res) => {
  res.json(await meService.getCounts(getAuthUser(req).id))
})

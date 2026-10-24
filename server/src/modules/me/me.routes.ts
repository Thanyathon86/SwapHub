import { Router } from 'express'
import { getAuthUser, requireAuth } from '../../middleware/requireAuth.js'
import { uploadImage } from '../../middleware/uploadImage.js'
import { validate } from '../../middleware/validate.js'
import { updateProfileSchema, type UpdateProfileInput } from './me.schema.js'
import * as meService from './me.service.js'

export const meRouter = Router()

meRouter.use(requireAuth)

// หน้าเว็บเรียกทุกนาทีเพื่อแสดงตัวเลขบนเมนู จึงคืนแค่ตัวเลข ไม่ดึงรายการ
meRouter.get('/counts', async (req, res) => {
  res.json(await meService.getCounts(getAuthUser(req).id))
})

// ทุก endpoint ที่แก้โปรไฟล์คืน user ชุดเดียวกับ /auth/me ให้หน้าเว็บอัปเดตรูปและชื่อบนเมนูได้ทันที
meRouter.patch('/profile', validate({ body: updateProfileSchema }), async (req, res) => {
  res.json({ user: await meService.updateProfile(getAuthUser(req).id, req.body as UpdateProfileInput) })
})

meRouter.post('/avatar', uploadImage, async (req, res) => {
  // uploadImage รับประกันว่ามี req.file แล้ว
  res.json({ user: await meService.setAvatar(getAuthUser(req).id, req.file!.buffer) })
})

meRouter.delete('/avatar', async (req, res) => {
  res.json({ user: await meService.removeAvatar(getAuthUser(req).id) })
})

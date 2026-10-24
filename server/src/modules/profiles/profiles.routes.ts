import { Router } from 'express'
import { z } from 'zod'
import { validate } from '../../middleware/validate.js'
import * as profilesService from './profiles.service.js'

// ดูได้โดยไม่ต้องล็อกอิน เหมือนหน้าประกาศ
export const profilesRouter = Router()

// รับแบบหลวมกว่าตอนตั้งชื่อ (ไม่เช็กกฎเรื่องจุด) แค่กันค่ายาวผิดปกติ ถ้าไม่มีก็ได้ 404 อยู่แล้ว
const usernameParams = z.strictObject({ username: z.string().min(1).max(40) })
type UsernameParams = z.infer<typeof usernameParams>

profilesRouter.get('/:username', validate({ params: usernameParams }), async (req, res) => {
  const { username } = req.params as UsernameParams
  res.json(await profilesService.getProfile(username))
})

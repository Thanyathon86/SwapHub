import { Router } from 'express'
import { validate } from '../../middleware/validate.js'
import {
  createGameSchema,
  createGradingCompanySchema,
  idParams,
  updateGameSchema,
  updateGradingCompanySchema,
  type CreateGameInput,
  type CreateGradingCompanyInput,
  type IdParams,
  type UpdateGameInput,
  type UpdateGradingCompanyInput,
} from './catalog.schema.js'
import * as catalogService from './catalog.service.js'

// mount ใต้ adminRouter เท่านั้น สิทธิ์ ADMIN ถูกตรวจที่นั่นแล้ว
// ไม่มี DELETE เพราะ listing อ้างถึงแบบ Restrict ให้ปิด isActive แทน
export const catalogAdminRouter = Router()

catalogAdminRouter.get('/games', async (_req, res) => {
  res.json({ games: await catalogService.listGames() })
})

catalogAdminRouter.post('/games', validate({ body: createGameSchema }), async (req, res) => {
  res.status(201).json({ game: await catalogService.createGame(req.body as CreateGameInput) })
})

catalogAdminRouter.patch('/games/:id', validate({ params: idParams, body: updateGameSchema }), async (req, res) => {
  const { id } = req.params as IdParams
  res.json({ game: await catalogService.updateGame(id, req.body as UpdateGameInput) })
})

catalogAdminRouter.get('/grading-companies', async (_req, res) => {
  res.json({ gradingCompanies: await catalogService.listGradingCompanies() })
})

catalogAdminRouter.post('/grading-companies', validate({ body: createGradingCompanySchema }), async (req, res) => {
  const gradingCompany = await catalogService.createGradingCompany(req.body as CreateGradingCompanyInput)
  res.status(201).json({ gradingCompany })
})

catalogAdminRouter.patch(
  '/grading-companies/:id',
  validate({ params: idParams, body: updateGradingCompanySchema }),
  async (req, res) => {
    const { id } = req.params as IdParams
    const gradingCompany = await catalogService.updateGradingCompany(id, req.body as UpdateGradingCompanyInput)
    res.json({ gradingCompany })
  },
)

// เปิดให้ทุกคนดู ไม่ต้อง login เพราะใช้กรองหน้าแรกด้วย
export const catalogPublicRouter = Router()

catalogPublicRouter.get('/games', async (_req, res) => {
  res.json({ games: await catalogService.listActiveGames() })
})

catalogPublicRouter.get('/grading-companies', async (_req, res) => {
  res.json({ gradingCompanies: await catalogService.listActiveGradingCompanies() })
})

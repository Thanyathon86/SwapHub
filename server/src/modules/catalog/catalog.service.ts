import { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { prisma } from '../../lib/prisma.js'
import type {
  CreateGameInput,
  CreateGradingCompanyInput,
  UpdateGameInput,
  UpdateGradingCompanyInput,
} from './catalog.schema.js'

// แนบจำนวนประกาศให้ admin รู้ว่าปิดรายการนี้แล้วกระทบประกาศกี่อัน
const withListingCount = { _count: { select: { listings: true } } } as const

// แปลง error ของ Prisma ที่ client แก้เองได้เป็น AppError ที่เหลือโยนต่อให้ errorHandler
const mapWriteError = (notFoundCode: string) => (err: unknown) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') throw new AppError(409, 'ALREADY_EXISTS', 'Name or slug is already used')
    if (err.code === 'P2025') throw new AppError(404, notFoundCode, 'Not found')
  }
  throw err
}

export const listGames = () => prisma.game.findMany({ orderBy: { name: 'asc' }, include: withListingCount })

export const createGame = (input: CreateGameInput) =>
  prisma.game.create({ data: input, include: withListingCount }).catch(mapWriteError('GAME_NOT_FOUND'))

export const updateGame = (id: string, input: UpdateGameInput) =>
  prisma.game.update({ where: { id }, data: input, include: withListingCount }).catch(mapWriteError('GAME_NOT_FOUND'))

export const listGradingCompanies = () =>
  prisma.gradingCompany.findMany({ orderBy: { name: 'asc' }, include: withListingCount })

export const createGradingCompany = (input: CreateGradingCompanyInput) =>
  prisma.gradingCompany
    .create({ data: input, include: withListingCount })
    .catch(mapWriteError('GRADING_COMPANY_NOT_FOUND'))

export const updateGradingCompany = (id: string, input: UpdateGradingCompanyInput) =>
  prisma.gradingCompany
    .update({ where: { id }, data: input, include: withListingCount })
    .catch(mapWriteError('GRADING_COMPANY_NOT_FOUND'))

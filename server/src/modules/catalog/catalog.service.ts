import { randomUUID } from 'node:crypto'
import { Prisma } from '../../generated/prisma/client.js'
import { AppError } from '../../lib/errors.js'
import { processGameImage } from '../../lib/images.js'
import { prisma } from '../../lib/prisma.js'
import { removeFile, saveFile } from '../../lib/storage.js'
import { recordAudit } from '../audit/audit.service.js'
import { publicWhere } from '../listings/listings.service.js'
import type {
  CreateGameInput,
  CreateGradingCompanyInput,
  UpdateGameInput,
  UpdateGradingCompanyInput,
} from './catalog.schema.js'

// จำนวนเกมในแถวบนหน้าแรก เกมที่เหลือยังหาได้จากหน้าเรียกดู
const POPULAR_GAMES_LIMIT = 5

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

// เกมและบริษัทเกรดกระทบผู้ขายทุกคนที่ใช้รายการนั้น จึงไม่มีผู้ใช้เป้าหมายคนเดียว รายละเอียดทั้งหมดอยู่ใน detail
const recordCatalogChange = (db: Prisma.TransactionClient, actorId: string, detail: string) =>
  recordAudit(db, { actorId, action: 'CATALOG_CHANGED', detail })

type CatalogFields = { name: string; slug?: string; isActive: boolean }

// บอกเฉพาะสิ่งที่เปลี่ยนจริง ถ้ากดบันทึกโดยไม่ได้แก้อะไรจะได้สตริงว่างและไม่ลง log ให้ประวัติมีแต่การเปลี่ยนจริง
const describeChanges = (before: CatalogFields, after: CatalogFields) =>
  [
    before.name !== after.name && `ชื่อ "${before.name}" เป็น "${after.name}"`,
    before.slug !== after.slug && `slug "${before.slug}" เป็น "${after.slug}"`,
    before.isActive !== after.isActive && (after.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'),
  ]
    .filter(Boolean)
    .join(', ')

export const listGames = () => prisma.game.findMany({ orderBy: { name: 'asc' }, include: withListingCount })

export const createGame = (actorId: string, input: CreateGameInput) =>
  prisma
    .$transaction(async (tx) => {
      const game = await tx.game.create({ data: input, include: withListingCount })
      await recordCatalogChange(tx, actorId, `เพิ่มเกม "${game.name}"`)
      return game
    })
    .catch(mapWriteError('GAME_NOT_FOUND'))

export const updateGame = (actorId: string, id: string, input: UpdateGameInput) =>
  prisma
    .$transaction(async (tx) => {
      const before = await tx.game.findUnique({ where: { id }, select: { name: true, slug: true, isActive: true } })
      if (!before) throw new AppError(404, 'GAME_NOT_FOUND', 'Not found')
      const game = await tx.game.update({ where: { id }, data: input, include: withListingCount })
      const changes = describeChanges(before, game)
      if (changes) await recordCatalogChange(tx, actorId, `แก้เกม "${before.name}": ${changes}`)
      return game
    })
    .catch(mapWriteError('GAME_NOT_FOUND'))

const currentImageKey = async (id: string) => {
  const game = await prisma.game.findUnique({ where: { id }, select: { imageKey: true } })
  if (!game) throw new AppError(404, 'GAME_NOT_FOUND', 'Not found')
  return game.imageKey
}

// ลบไฟล์เก่าไม่สำเร็จไม่ควรทำให้ทั้ง request ล้ม เพราะ DB ชี้ไปรูปที่ถูกต้องแล้ว
const removeOldImage = async (key: string | null) => {
  if (key) await removeFile(key).catch((err: unknown) => console.error('Failed to remove old game image:', err))
}

export const setGameImage = async (actorId: string, id: string, file: Buffer) => {
  const before = await currentImageKey(id)
  const data = await processGameImage(file)
  // ชื่อไฟล์ใหม่ทุกครั้ง browser ที่ cache รูปเก่าไว้จะไม่เห็นรูปเดิมค้าง
  const key = `games/${id}/${randomUUID()}.webp`
  await saveFile(key, data)
  const game = await prisma
    .$transaction(async (tx) => {
      const updated = await tx.game.update({ where: { id }, data: { imageKey: key }, include: withListingCount })
      await recordCatalogChange(tx, actorId, `เปลี่ยนรูปเกม "${updated.name}"`)
      return updated
    })
    .catch(async (err: unknown) => {
      // บันทึก DB ไม่สำเร็จ ไฟล์ใหม่ไม่มีใครอ้างถึง ลบทิ้ง
      await removeFile(key)
      return mapWriteError('GAME_NOT_FOUND')(err)
    })
  await removeOldImage(before)
  return game
}

export const removeGameImage = async (actorId: string, id: string) => {
  const before = await currentImageKey(id)
  const game = await prisma
    .$transaction(async (tx) => {
      const updated = await tx.game.update({ where: { id }, data: { imageKey: null }, include: withListingCount })
      if (before) await recordCatalogChange(tx, actorId, `ลบรูปเกม "${updated.name}"`)
      return updated
    })
    .catch(mapWriteError('GAME_NOT_FOUND'))
  await removeOldImage(before)
  return game
}

export const listGradingCompanies = () =>
  prisma.gradingCompany.findMany({ orderBy: { name: 'asc' }, include: withListingCount })

export const createGradingCompany = (actorId: string, input: CreateGradingCompanyInput) =>
  prisma
    .$transaction(async (tx) => {
      const company = await tx.gradingCompany.create({ data: input, include: withListingCount })
      await recordCatalogChange(tx, actorId, `เพิ่มบริษัทเกรด "${company.name}"`)
      return company
    })
    .catch(mapWriteError('GRADING_COMPANY_NOT_FOUND'))

export const updateGradingCompany = (actorId: string, id: string, input: UpdateGradingCompanyInput) =>
  prisma
    .$transaction(async (tx) => {
      const before = await tx.gradingCompany.findUnique({ where: { id }, select: { name: true, isActive: true } })
      if (!before) throw new AppError(404, 'GRADING_COMPANY_NOT_FOUND', 'Not found')
      const company = await tx.gradingCompany.update({ where: { id }, data: input, include: withListingCount })
      const changes = describeChanges(before, company)
      if (changes) await recordCatalogChange(tx, actorId, `แก้บริษัทเกรด "${before.name}": ${changes}`)
      return company
    })
    .catch(mapWriteError('GRADING_COMPANY_NOT_FOUND'))

// สำหรับ user เลือกตอนลงประกาศและกรองหน้าแรก ส่งเฉพาะที่เปิดใช้และไม่ต้องมีจำนวนประกาศ
export const listActiveGames = () =>
  prisma.game.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, imageKey: true },
    orderBy: { name: 'asc' },
  })

// นับเฉพาะประกาศที่คนทั่วไปเห็นได้ ของที่รอตรวจหรือปิดแล้วไม่ควรดันอันดับ เกมที่มีประกาศไม่พอจะถูกเติมด้วยเกมอื่นโดยอัตโนมัติ
export const listPopularGames = async () => {
  const games = await prisma.game.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      imageKey: true,
      _count: { select: { listings: { where: publicWhere } } },
    },
    orderBy: { name: 'asc' },
  })
  // sort ของ JS คงลำดับเดิมเมื่อค่าเท่ากัน เกมที่จำนวนประกาศเท่ากันจึงยังเรียงตามชื่อ
  return games
    .sort((a, b) => b._count.listings - a._count.listings)
    .slice(0, POPULAR_GAMES_LIMIT)
    .map(({ _count, ...game }) => game)
}

export const listActiveGradingCompanies = () =>
  prisma.gradingCompany.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

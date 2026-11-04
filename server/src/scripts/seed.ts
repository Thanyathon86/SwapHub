import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { seedAdmin } from './seedAdmin.js'

const defaultGames = [
  { name: 'Pokémon', slug: 'pokemon' },
  { name: 'Yu-Gi-Oh!', slug: 'yu-gi-oh' },
  { name: 'Magic: The Gathering', slug: 'mtg' },
  { name: 'One Piece', slug: 'one-piece' },
]

const defaultGradingCompanies = ['PSA', 'BGS', 'CGC']

const seedCatalog = async () => {
  // update ว่างไว้ รันซ้ำแล้วจะไม่ทับค่าที่ admin แก้ผ่านหลังบ้าน
  for (const game of defaultGames) {
    await prisma.game.upsert({ where: { slug: game.slug }, update: {}, create: game })
  }
  for (const name of defaultGradingCompanies) {
    await prisma.gradingCompany.upsert({ where: { name }, update: {}, create: { name } })
  }
  console.log(`Catalog ready: ${defaultGames.length} games, ${defaultGradingCompanies.length} grading companies`)
}

const main = async () => {
  // ทำ catalog ก่อน ถ้าค่า admin ใช้ไม่ได้จะได้ไม่ค้างทั้งหมด
  await seedCatalog()
  // หลังสร้าง admin แล้วมักลบค่าออกจาก .env จึงข้ามแทนที่จะหยุด
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set, skipping admin')
    return
  }
  await seedAdmin(env.ADMIN_EMAIL, env.ADMIN_PASSWORD)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

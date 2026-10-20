import { env } from '../config/env.js'
import { hashPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'

const defaultGames = [
  { name: 'Pokémon', slug: 'pokemon' },
  { name: 'Yu-Gi-Oh!', slug: 'yu-gi-oh' },
  { name: 'Magic: The Gathering', slug: 'mtg' },
  { name: 'One Piece', slug: 'one-piece' },
]

const defaultGradingCompanies = ['PSA', 'BGS', 'CGC']

// สร้าง admin คนแรก รันซ้ำได้: ถ้ามีอีเมลนี้แล้วจะแค่ยกเป็น ADMIN ไม่ทับรหัสผ่านเดิม
const seedAdmin = async () => {
  // หลังสร้าง admin แล้วมักลบค่าออกจาก .env จึงข้ามแทนที่จะหยุด ไม่งั้นจะ seed ส่วนอื่นไม่ได้
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.warn('ADMIN_EMAIL/ADMIN_PASSWORD not set, skipping admin')
    return
  }
  const email = env.ADMIN_EMAIL.trim().toLowerCase()

  const admin = await prisma.user.upsert({
    where: { email },
    update: { role: 'ADMIN' },
    create: {
      email,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      displayName: 'Admin',
      role: 'ADMIN',
    },
  })
  console.log(`Admin ready: ${admin.email}`)
}

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
  await seedAdmin()
  await seedCatalog()
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

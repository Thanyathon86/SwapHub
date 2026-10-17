import { env } from '../config/env.js'
import { hashPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'

// สร้าง admin คนแรก รันซ้ำได้: ถ้ามีอีเมลนี้แล้วจะแค่ยกเป็น ADMIN ไม่ทับรหัสผ่านเดิม
const main = async () => {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding')
    process.exit(1)
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

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

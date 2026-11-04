import { hashPassword, isGuessablePassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'

// แยกจาก seed.ts ที่รันทันทีตอน import จะได้เขียน test ได้
// รันซ้ำได้: อีเมลที่เป็น admin อยู่แล้วจะไม่ถูกแก้ ไม่ทับรหัสผ่านเดิม
export const seedAdmin = async (rawEmail: string, password: string) => {
  const email = rawEmail.trim().toLowerCase()
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } })
  if (existing?.role === 'ADMIN') {
    console.log(`Admin already exists: ${email}`)
    return
  }
  // ตอนสมัครไม่ได้ยืนยันอีเมล คนอื่นอาจสมัครอีเมลนี้ดักไว้ ถ้ายกเป็น admin เขาจะได้สิทธิ์ด้วยรหัสของเขาเอง
  if (existing) {
    throw new Error(`${email} is an existing user account. Choose another ADMIN_EMAIL or promote it from the admin site`)
  }
  // เผื่อคัดลอก .env ตัวอย่างไปใช้ตรง ๆ รหัสที่ทุกคนเห็นได้ใน repo ต้องไม่กลายเป็นรหัส admin จริง
  if (/change[_-]?me/i.test(password) || isGuessablePassword(password, email)) {
    throw new Error('ADMIN_PASSWORD is a placeholder or too easy to guess. Set a strong one')
  }

  const admin = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), displayName: 'Admin', role: 'ADMIN' },
  })
  console.log(`Admin created: ${admin.email}`)
}
